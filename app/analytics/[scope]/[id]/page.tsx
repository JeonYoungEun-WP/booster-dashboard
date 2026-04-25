'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { RefreshCw, FileText } from 'lucide-react'
import { DateRangePicker } from '@/src/components/ui/DateRangePicker'
import { FunnelFlow } from '@/src/components/analytics/FunnelFlow'
import { KpiGrid } from '@/src/components/analytics/KpiGrid'
import { TrendChart, type TrendPoint } from '@/src/components/analytics/TrendChart'
import {
  TrendGranularityToggle, aggregateTrend, type TrendGranularity,
} from '@/src/components/analytics/TrendGranularityToggle'
import { ChannelDonut, type ChannelDonutRow } from '@/src/components/analytics/ChannelDonut'
import { TrackingCodeTable, type TrackingCodeRow } from '@/src/components/analytics/TrackingCodeTable'
import { SourceTable } from '@/src/components/analytics/SourceTable'
import { FunnelMetricsTable, type FunnelStageRow } from '@/src/components/analytics/FunnelMetricsTable'
import { ChannelFunnelCompareTable, type ChannelFunnelGroup } from '@/src/components/analytics/ChannelFunnelCompareTable'
import { ReportModeDialog } from '@/src/components/analytics/ReportModeDialog'
import { ClarityCard, type ClarityCardData } from '@/src/components/analytics/ClarityCard'
import { AiDiagnosisCard } from '@/src/components/analytics/AiDiagnosisCard'
import { BreadcrumbScopeSelector } from '@/src/components/analytics/BreadcrumbScopeSelector'
import type { AdChannel, CampaignPerformance } from '@/src/lib/ad-data'
import type { ScopeType, ScopeBreadcrumb } from '@/src/lib/scope-catalog'

interface ChannelRow {
  channel: AdChannel
  adSpend: number; impressions: number; clicks: number; leads: number
  reservations: number; contracts: number; revenue: number
  cpa_lead: number; cpa_reservation: number; cpa_contract: number; roas: number
}

interface Funnel {
  adSpend: number; impressions: number; clicks: number; sessions: number; pageViews: number
  leads: number; visitReservations: number; reservations: number
  averageOrderValue: number; reservationRevenue: number
  ctr: number; cpc: number
  cpa_lead: number; cpa_visitReservation: number; cpa_reservation: number
  cvr_click_to_session: number; cvr_session_to_lead: number
  cvr_lead_to_visitReservation: number; cvr_visitReservation_to_payment: number
  cvr_lead_to_reservation: number; trueROAS_estimated: number
}

interface GA4Section {
  propertyId?: string
  totals?: { sessions: number; screenPageViews: number; averageSessionDuration: number; engagementRate: number; conversions: number }
  daily?: Array<{ date: string; sessions: number; activeUsers: number; conversions: number }>
  bySource?: Array<{ source: string; medium: string; campaign: string; sessions: number; conversions: number }>
  unavailable?: boolean; reason?: string; error?: string
}

interface LeadsSection {
  leadCount: number; reservationCount: number
  byStatus: Array<{ status: string; count: number }>
  byTrackingCode: Array<{ trackingCode: string; leads: number; reservations: number }>
  byDate: Array<{ date: string; leads: number; reservations: number }>
  simulated?: boolean; error?: string
}

interface AdsSection {
  eventCampaigns: CampaignPerformance[]
  accountChannelSummary: unknown[]
  totalCampaignCount: number; eventCampaignCount: number; error?: string
}

interface RealDataNote {
  eventId: string; period: { startDate: string; endDate: string }; advertiser: string
}

interface ScopeAnalyticsResponse {
  period: { startDate: string; endDate: string }
  eventId: string
  legacySlug: string | null; trackingCode: string | null
  landingPaths: string[]
  realDataNote: RealDataNote | null
  funnel: Funnel
  byChannel: ChannelRow[]
  byTrackingCode: TrackingCodeRow[]
  ga4: GA4Section
  clarity: ClarityCardData
  leads: LeadsSection
  ads: AdsSection
  scope: ScopeType
  scopeId: string
  breadcrumb: ScopeBreadcrumb
  includedEventIds: string[]
}

function fmtNumber(n: number): string { return Math.round(n).toLocaleString('ko-KR') }
function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m === 0) return `${s}초`
  return `${m}분 ${s}초`
}

export default function ScopeAnalyticsPage() {
  const router = useRouter()
  const params = useParams<{ scope: string; id: string }>()
  const search = useSearchParams()
  const scope = (params?.scope ?? 'event') as ScopeType
  const id = params?.id ?? ''

  // 유효성 검증 — 잘못된 scope 값이면 기본 브랜드로
  useEffect(() => {
    if (scope !== 'brand' && scope !== 'project' && scope !== 'event') {
      router.replace('/analytics')
    }
  }, [scope, router])

  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [excludeTest, setExcludeTest] = useState(false)
  const [data, setData] = useState<ScopeAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [granularity, setGranularity] = useState<TrendGranularity>('day')
  const [reportOpen, setReportOpen] = useState(false)

  // scope/id 변경 시 기간 재설정 (API 응답의 period 로 덮어쓰기)
  useEffect(() => {
    setStartDate('')
    setEndDate('')
  }, [scope, id])

  useEffect(() => {
    if (!scope || !id) return
    setLoading(true)
    setError(null)

    const qs = new URLSearchParams({ scope, id })
    if (startDate) qs.set('startDate', startDate)
    if (endDate) qs.set('endDate', endDate)
    if (excludeTest) qs.set('excludeTest', '1')
    // 쿼리로 넘어온 legacySlug (이벤트 수준 backward-compat)
    const legacy = search?.get('legacySlug')
    if (legacy && scope === 'event') qs.set('legacySlug', legacy)

    fetch(`/api/scope-analytics?${qs.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)
        return r.json() as Promise<ScopeAnalyticsResponse>
      })
      .then((cur) => {
        setData(cur)
        // API 응답의 기본 기간을 state 에 반영 (UI 초기 선택값)
        if (!startDate && !endDate) {
          setStartDate(cur.period.startDate)
          setEndDate(cur.period.endDate)
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [scope, id, startDate, endDate, excludeTest, refreshTick, search])

  // ─── 파생 상태 ───
  const trendDaily: TrendPoint[] = useMemo(() => {
    if (!data) return []
    const ga4Daily = data.ga4.daily ?? []
    const leadsByDate = new Map(data.leads.byDate?.map((r) => [r.date, r]) ?? [])
    const baseDates = ga4Daily.length > 0 ? ga4Daily.map((r) => r.date) : (data.leads.byDate ?? []).map((r) => r.date)
    return baseDates.map((date) => {
      const g = ga4Daily.find((r) => r.date === date)
      const l = leadsByDate.get(date)
      return { date, sessions: g?.sessions ?? 0, leads: l?.leads ?? 0, reservations: l?.reservations ?? 0 }
    })
  }, [data])

  const trendData: TrendPoint[] = useMemo(
    () => aggregateTrend(trendDaily, granularity),
    [trendDaily, granularity],
  )

  const kpi = useMemo(() => {
    if (!data) return []
    const f = data.funnel
    const avgDuration = data.ga4.totals?.averageSessionDuration ?? 0
    return [
      { label: '페이지뷰', value: fmtNumber(f.pageViews), source: 'ga' as const },
      { label: '세션', value: fmtNumber(f.sessions), source: 'ga' as const },
      { label: '평균 체류', value: fmtDuration(avgDuration), source: 'ga' as const },
    ]
  }, [data])

  // 3550 용어 체계 — event scope 이고 id=3550 일 때만
  const is3550 = data?.scope === 'event' && data?.scopeId === '3550'

  const funnelStages = useMemo(() => {
    if (!data) return []
    const f = data.funnel
    return [
      { label: '노출', value: f.impressions, source: 'admin' as const },
      { label: '클릭', value: f.clicks, source: 'admin' as const, cpu: f.cpc, cpuLabel: 'CPC · 클릭당 광고비' },
      { label: '리드', value: f.leads, source: 'admin' as const, cpu: f.cpa_lead, cpuLabel: 'CPA · 리드 획득당 비용' },
      { label: is3550 ? '예약' : '방문예약', value: f.visitReservations, source: 'dummy' as const,
        cpu: f.cpa_visitReservation,
        cpuLabel: is3550 ? '예약당 단가 · 지출 ÷ 예약' : '예약 획득비용 · 방문예약 1건당' },
      { label: is3550 ? '계약' : '결제', value: f.reservations, source: 'dummy' as const,
        cpu: f.cpa_reservation,
        cpuLabel: is3550 ? '계약당 단가 · 지출 ÷ 계약' : '결제당 광고비용 · 결제 1건당' },
    ]
  }, [data, is3550])

  const sessionsByChannel = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const s of data?.ga4.bySource ?? []) {
      const src = s.source.toLowerCase()
      const channel = src.includes('facebook') || src.includes('meta') || src.includes('instagram') ? 'meta'
        : src.includes('tiktok') ? 'tiktok'
        : src.includes('naver') ? 'naver'
        : src.includes('google') ? 'google'
        : src.includes('kakao') ? 'kakao'
        : src.includes('daangn') || src.includes('karrot') ? 'karrot'
        : null
      if (channel) out[channel] = (out[channel] ?? 0) + s.sessions
    }
    return out
  }, [data])

  const channelDonutRows = useMemo<ChannelDonutRow[]>(() => {
    if (!data) return []
    const safeRate = (num: number, den: number) => (den > 0 ? num / den : 0)
    return (data.byChannel ?? []).map((c) => ({
      channel: c.channel,
      leads: c.leads, adSpend: c.adSpend,
      sessions: sessionsByChannel[c.channel] ?? 0,
      cvrLead: safeRate(c.leads, c.clicks),
      cvrReservation: safeRate(c.reservations, c.leads),
      cvrContract: safeRate(c.contracts, c.reservations),
      roas: c.roas,
    })).sort((a, b) => b.leads - a.leads)
  }, [data, sessionsByChannel])

  const funnelMetricRows = useMemo<FunnelStageRow[]>(() => {
    if (!data) return []
    const f = data.funnel
    const reserveLabel = is3550 ? '예약' : '방문예약'
    const contractLabel = is3550 ? '계약' : '결제'
    const safeRate = (num: number, den: number) => (den > 0 ? num / den : 0)
    return [
      { label: '노출', value: f.impressions, source: 'admin' },
      { label: '클릭', value: f.clicks, source: 'admin',
        prevLabel: '노출', conversionRate: safeRate(f.clicks, f.impressions),
        costPerAction: f.cpc, costLabel: 'CPC · 클릭당 광고비' },
      { label: '리드', value: f.leads, source: 'admin',
        prevLabel: '클릭', conversionRate: safeRate(f.leads, f.clicks),
        costPerAction: f.cpa_lead, costLabel: 'CPA · 리드 획득당 비용' },
      { label: reserveLabel, value: f.visitReservations, source: 'dummy',
        prevLabel: '리드', conversionRate: safeRate(f.visitReservations, f.leads),
        costPerAction: f.cpa_visitReservation,
        costLabel: is3550 ? '예약당 단가 · 지출 ÷ 예약' : '예약 획득비용 · 방문예약 1건당' },
      { label: contractLabel, value: f.reservations, source: 'dummy',
        prevLabel: reserveLabel, conversionRate: safeRate(f.reservations, f.visitReservations),
        costPerAction: f.cpa_reservation,
        costLabel: is3550 ? '계약당 단가 · 지출 ÷ 계약' : '결제당 광고비용 · 결제 1건당' },
    ]
  }, [data, is3550])

  const channelFunnelTables = useMemo(() => {
    if (!data) return []
    const reserveLabel = is3550 ? '예약' : '방문예약'
    const contractLabel = is3550 ? '계약' : '결제'
    const safeRate = (num: number, den: number) => (den > 0 ? num / den : 0)
    return (data.byChannel ?? [])
      .slice()
      .sort((a, b) => b.leads - a.leads)
      .map((c) => {
        const cpc = c.clicks > 0 ? c.adSpend / c.clicks : 0
        const rows: FunnelStageRow[] = [
          { label: '노출', value: c.impressions, source: 'admin' },
          { label: '클릭', value: c.clicks, source: 'admin',
            prevLabel: '노출', conversionRate: safeRate(c.clicks, c.impressions),
            costPerAction: cpc, costLabel: 'CPC · 클릭당 광고비' },
          { label: '리드', value: c.leads, source: 'admin',
            prevLabel: '클릭', conversionRate: safeRate(c.leads, c.clicks),
            costPerAction: c.cpa_lead, costLabel: 'CPA · 리드 획득당 비용' },
          { label: reserveLabel, value: c.reservations, source: 'dummy',
            prevLabel: '리드', conversionRate: safeRate(c.reservations, c.leads),
            costPerAction: c.cpa_reservation,
            costLabel: is3550 ? '예약당 단가 · 지출 ÷ 예약' : '예약 획득비용 · 방문예약 1건당' },
          { label: contractLabel, value: c.contracts, source: 'dummy',
            prevLabel: reserveLabel, conversionRate: safeRate(c.contracts, c.reservations),
            costPerAction: c.cpa_contract,
            costLabel: is3550 ? '계약당 단가 · 지출 ÷ 계약' : '결제당 광고비용 · 결제 1건당' },
        ]
        return { channel: c.channel, rows, adSpend: c.adSpend, revenue: c.revenue, roas: c.roas }
      })
  }, [data, is3550])

  const breadcrumb = data?.breadcrumb

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">풀퍼널 성과분석</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {breadcrumb ? `${breadcrumb.title} · ${breadcrumb.subtitle}` : '로딩 중…'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm inline-flex items-center gap-1.5 text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={excludeTest}
                  onChange={(e) => setExcludeTest(e.target.checked)}
                  className="rounded" />
                테스트 제외
              </label>
              <button type="button" onClick={() => setRefreshTick((t) => t + 1)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="새로고침" aria-label="새로고침">
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={() => setReportOpen(true)} disabled={!data}
                className="inline-flex items-center gap-1.5 text-sm rounded-md bg-primary text-primary-foreground px-3.5 py-2 hover:bg-primary/90 disabled:opacity-50 font-semibold shadow-sm"
                title="리포트 모드 (PPT·PDF·Excel 다운로드)">
                <FileText size={14} /> 리포트 모드
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 space-y-5">
        {/* 분석 범위 셀렉터 (스코프 카드) */}
        {breadcrumb && <BreadcrumbScopeSelector breadcrumb={breadcrumb} />}

        {/* 기간 + 메타 정보 라인 */}
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker startDate={startDate} endDate={endDate}
            onChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          {data?.scope === 'event' && data?.landingPaths?.length > 0 && (
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
              <span className="text-muted-foreground/70">랜딩 URL:</span>
              {data.landingPaths.map((p) => (
                <span key={p} className="bg-muted px-2 py-0.5 rounded font-mono">
                  heypick.co.kr{p}
                </span>
              ))}
            </div>
          )}
          {data?.leads.simulated && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              🧪 리드·예약 더미 (Phase 2 에서 실 DB 연동)
            </div>
          )}
        </div>

        {loading && !data && (
          <div className="text-center text-base text-muted-foreground py-20">데이터를 불러오는 중...</div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700">
            오류: {error}
          </div>
        )}

        {data && (
          <>
            <AiDiagnosisCard
              eventId={data.scope === 'event' ? data.scopeId : data.eventId}
              advertiser={data.realDataNote?.advertiser ?? breadcrumb?.title ?? '—'}
              period={data.period}
              funnel={data.funnel}
              byChannel={data.byChannel}
              byTrackingCode={data.byTrackingCode}
            />

            <FunnelFlow
              stages={funnelStages}
              trueROAS={data.funnel.trueROAS_estimated}
              adSpend={data.funnel.adSpend}
              averageOrderValue={data.funnel.averageOrderValue}
              reservationRevenue={data.funnel.reservationRevenue}
            />

            <KpiGrid items={kpi} />

            <TrendChart
              data={trendData}
              actions={<TrendGranularityToggle value={granularity} onChange={setGranularity} />}
            />

            {channelFunnelTables.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
                <ChannelDonut rows={channelDonutRows} />
                <ChannelFunnelCompareTable
                  groups={channelFunnelTables.map((t) => ({
                    channel: t.channel as AdChannel,
                    rows: t.rows, adSpend: t.adSpend, revenue: t.revenue, roas: t.roas,
                  })) as ChannelFunnelGroup[]}
                />
              </div>
            ) : (
              <FunnelMetricsTable
                rows={funnelMetricRows}
                adSpend={data.funnel.adSpend}
                revenue={data.funnel.reservationRevenue}
                roas={data.funnel.trueROAS_estimated}
              />
            )}

            <TrackingCodeTable rows={data.byTrackingCode} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <SourceTable
                rows={data.ga4.bySource ?? []}
                unavailableReason={
                  data.ga4.unavailable
                    ? (data.ga4.reason === 'no_creds' ? 'GA4 자격증명 (WIF) 셋업 후 활성화' : data.ga4.reason)
                    : data.ga4.error
                }
              />
              <ClarityCard data={data.clarity} />
            </div>
          </>
        )}
      </div>

      <ReportModeDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        data={data as never}
      />
    </div>
  )
}
