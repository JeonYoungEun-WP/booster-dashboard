'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
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
import { ClarityCard, type ClarityCardData } from '@/src/components/analytics/ClarityCard'
import type { AdChannel, CampaignPerformance } from '@/src/lib/ad-data'

// 채널별 풀 퍼널 집계 (API byChannel 응답)
interface ChannelRow {
  channel: AdChannel
  adSpend: number
  impressions: number
  clicks: number
  leads: number
  reservations: number
  contracts: number
  revenue: number
  cpa_lead: number
  cpa_reservation: number
  cpa_contract: number
  roas: number
}

// ───── 응답 타입 ─────

interface Funnel {
  adSpend: number
  impressions: number
  clicks: number
  sessions: number
  pageViews: number
  leads: number
  visitReservations: number                 // 방문예약 (상담 완료)
  reservations: number                      // 결제 (최종 매출)
  averageOrderValue: number
  reservationRevenue: number
  ctr: number
  cpc: number
  cpa_lead: number                          // 리드 획득당 비용
  cpa_visitReservation: number              // 예약 획득비용 (방문예약 1건당)
  cpa_reservation: number                   // 결제당 광고비용
  cvr_click_to_session: number
  cvr_session_to_lead: number
  cvr_lead_to_visitReservation: number
  cvr_visitReservation_to_payment: number
  cvr_lead_to_reservation: number
  trueROAS_estimated: number
}

interface GA4Section {
  propertyId?: string
  totals?: { sessions: number; screenPageViews: number; averageSessionDuration: number; engagementRate: number; conversions: number }
  daily?: Array<{ date: string; sessions: number; activeUsers: number; conversions: number }>
  bySource?: Array<{ source: string; medium: string; campaign: string; sessions: number; conversions: number }>
  unavailable?: boolean
  reason?: string
  error?: string
}

interface LeadsSection {
  leadCount: number
  reservationCount: number
  byStatus: Array<{ status: string; count: number }>
  byTrackingCode: Array<{ trackingCode: string; leads: number; reservations: number }>
  byDate: Array<{ date: string; leads: number; reservations: number }>
  simulated?: boolean
  error?: string
}

interface AdsSection {
  eventCampaigns: CampaignPerformance[]
  accountChannelSummary: unknown[]
  totalCampaignCount: number
  eventCampaignCount: number
  error?: string
}

interface RealDataNote {
  eventId: string
  period: { startDate: string; endDate: string }
  advertiser: string
}

interface EventAnalyticsResponse {
  period: { startDate: string; endDate: string }
  eventId: string
  legacySlug: string | null
  trackingCode: string | null
  landingPaths: string[]
  realDataNote: RealDataNote | null
  funnel: Funnel
  byChannel: ChannelRow[]
  byTrackingCode: TrackingCodeRow[]
  ga4: GA4Section
  clarity: ClarityCardData
  leads: LeadsSection
  ads: AdsSection
}

// ───── 유틸 ─────

function offsetDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
function fmtKRW(n: number): string {
  return '₩' + Math.round(n).toLocaleString('ko-KR')
}
function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%'
}
function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m === 0) return `${s}초`
  return `${m}분 ${s}초`
}

// ───── 페이지 ─────

const DEFAULT_VIEW = '기본' as const
const DISABLED_VIEWS = ['기간 비교', '페이지 비교', '설문 통계']

// 이벤트별 실데이터 기준 기간 — 기본 날짜 범위 힌트
const EVENT_DEFAULT_DATE_RANGE: Record<string, { startDate: string; endDate: string }> = {
  '1042': { startDate: '2026-03-01', endDate: '2026-03-31' },
  '3550': { startDate: '2026-03-22', endDate: '2026-04-21' },
}

export default function EventAnalyticsPage() {
  const params = useParams<{ eventId: string }>()
  const search = useSearchParams()
  const eventId = params?.eventId ?? ''
  const legacySlug = search?.get('legacySlug') ?? undefined

  const initialRange = EVENT_DEFAULT_DATE_RANGE[eventId] ?? { startDate: offsetDate(7), endDate: offsetDate(0) }
  const [startDate, setStartDate] = useState(initialRange.startDate)
  const [endDate, setEndDate] = useState(initialRange.endDate)
  const [excludeTest, setExcludeTest] = useState(false)
  const [data, setData] = useState<EventAnalyticsResponse | null>(null)
  const [prevData, setPrevData] = useState<EventAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [granularity, setGranularity] = useState<TrendGranularity>('day')

  useEffect(() => {
    if (!eventId) return
    setLoading(true)
    setError(null)

    // 전기 기간 계산 (같은 길이만큼 shift)
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
    const prevEnd = new Date(start.getTime() - 86400000).toISOString().slice(0, 10)
    const prevStart = new Date(start.getTime() - diffDays * 86400000).toISOString().slice(0, 10)

    const buildQs = (sd: string, ed: string) => {
      const qs = new URLSearchParams({ eventId, startDate: sd, endDate: ed })
      if (legacySlug) qs.set('legacySlug', legacySlug)
      if (excludeTest) qs.set('excludeTest', '1')
      return qs.toString()
    }

    const fetchOne = (sd: string, ed: string) =>
      fetch(`/api/event-analytics?${buildQs(sd, ed)}`).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`)
        return r.json() as Promise<EventAnalyticsResponse>
      })

    Promise.all([fetchOne(startDate, endDate), fetchOne(prevStart, prevEnd).catch(() => null)])
      .then(([cur, prev]) => { setData(cur); setPrevData(prev) })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [eventId, startDate, endDate, excludeTest, legacySlug, refreshTick])

  // 추이 데이터 = GA4 daily sessions + leads.byDate 에서 리드·예약 join (일별 원본)
  const trendDaily: TrendPoint[] = useMemo(() => {
    if (!data) return []
    const ga4Daily = data.ga4.daily ?? []
    const leadsByDate = new Map(data.leads.byDate?.map((r) => [r.date, r]) ?? [])
    const baseDates = ga4Daily.length > 0
      ? ga4Daily.map((r) => r.date)
      : (data.leads.byDate ?? []).map((r) => r.date)
    return baseDates.map((date) => {
      const g = ga4Daily.find((r) => r.date === date)
      const l = leadsByDate.get(date)
      return {
        date,
        sessions: g?.sessions ?? 0,
        leads: l?.leads ?? 0,
        reservations: l?.reservations ?? 0,
      }
    })
  }, [data])

  // granularity(일/주/월) 집계
  const trendData: TrendPoint[] = useMemo(
    () => aggregateTrend(trendDaily, granularity),
    [trendDaily, granularity],
  )

  const kpi = useMemo(() => {
    if (!data) return []
    const f = data.funnel
    const avgDuration = data.ga4.totals?.averageSessionDuration ?? 0
    // 퍼널·세션 중복 제거 — GA 전용 보조 지표만 남김
    return [
      { label: '페이지뷰', value: fmtNumber(f.pageViews), source: 'ga' as const },
      { label: '평균 체류', value: fmtDuration(avgDuration), source: 'ga' as const },
    ]
  }, [data])

  const funnelStages = useMemo(() => {
    if (!data) return []
    const f = data.funnel
    // 이벤트별 용어 커스터마이즈 — 3550(굿리치)는 "예약/계약" 체계
    // 세션은 클릭 수와 거의 동일(랜딩 직후 측정)이라 퍼널에서 제외 → 노출→클릭→리드→예약→계약 5단계
    const is3550 = eventId === '3550'
    return [
      { label: '노출',     value: f.impressions,      source: 'admin' as const },
      { label: '클릭',     value: f.clicks,           source: 'admin' as const,
        cpu: f.cpc,                 cpuLabel: 'CPC · 클릭당 광고비' },
      { label: '리드',     value: f.leads,            source: 'admin' as const,
        cpu: f.cpa_lead,            cpuLabel: 'CPA · 리드 획득당 비용' },
      { label: is3550 ? '예약' : '방문예약', value: f.visitReservations,
        source: 'dummy' as const,
        cpu: f.cpa_visitReservation,
        cpuLabel: is3550 ? '예약당 단가 · 지출 ÷ 예약' : '예약 획득비용 · 방문예약 1건당' },
      { label: is3550 ? '계약' : '결제',     value: f.reservations,
        source: 'dummy' as const,
        cpu: f.cpa_reservation,
        cpuLabel: is3550 ? '계약당 단가 · 지출 ÷ 계약' : '결제당 광고비용 · 결제 1건당' },
    ]
  }, [data, eventId])

  // GA4 bySource → 채널별 세션 집계 (facebook→meta, tiktok→tiktok 등)
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

  // 채널 도넛 rows — byChannel + sessionsByChannel 합성
  const channelDonutRows = useMemo<ChannelDonutRow[]>(() => {
    if (!data) return []
    return (data.byChannel ?? []).map((c) => {
      const sessions = sessionsByChannel[c.channel] ?? 0
      return {
        channel: c.channel,
        leads: c.leads,
        adSpend: c.adSpend,
        sessions,
        cvr: sessions > 0 ? c.leads / sessions : 0,
      }
    })
  }, [data, sessionsByChannel])

  // 퍼널 성과 요약 테이블용 — 각 단계의 수/전환율/전환 단가 그룹
  const funnelMetricRows = useMemo<FunnelStageRow[]>(() => {
    if (!data) return []
    const f = data.funnel
    const is3550 = eventId === '3550'
    const reserveLabel = is3550 ? '예약' : '방문예약'
    const contractLabel = is3550 ? '계약' : '결제'
    const safeRate = (num: number, den: number) => (den > 0 ? num / den : 0)
    return [
      { label: '노출', value: f.impressions, source: 'admin' },
      {
        label: '클릭', value: f.clicks, source: 'admin',
        prevLabel: '노출', conversionRate: safeRate(f.clicks, f.impressions),
        costPerAction: f.cpc, costLabel: 'CPC · 클릭당 광고비',
      },
      {
        label: '리드', value: f.leads, source: 'admin',
        prevLabel: '클릭', conversionRate: safeRate(f.leads, f.clicks),
        costPerAction: f.cpa_lead, costLabel: 'CPA · 리드 획득당 비용',
      },
      {
        label: reserveLabel, value: f.visitReservations, source: 'dummy',
        prevLabel: '리드', conversionRate: safeRate(f.visitReservations, f.leads),
        costPerAction: f.cpa_visitReservation,
        costLabel: is3550 ? '예약당 단가 · 지출 ÷ 예약' : '예약 획득비용 · 방문예약 1건당',
      },
      {
        label: contractLabel, value: f.reservations, source: 'dummy',
        prevLabel: reserveLabel, conversionRate: safeRate(f.reservations, f.visitReservations),
        costPerAction: f.cpa_reservation,
        costLabel: is3550 ? '계약당 단가 · 지출 ÷ 계약' : '결제당 광고비용 · 결제 1건당',
      },
    ]
  }, [data, eventId])

  // 채널별 퍼널 rows — byChannel(노출/클릭/리드/예약/계약/광고비) + sessionsByChannel(GA) 합성
  const channelFunnelTables = useMemo(() => {
    if (!data) return []
    const is3550 = eventId === '3550'
    const reserveLabel = is3550 ? '예약' : '방문예약'
    const contractLabel = is3550 ? '계약' : '결제'
    const safeRate = (num: number, den: number) => (den > 0 ? num / den : 0)
    return (data.byChannel ?? []).map((c) => {
      const cpc = c.clicks > 0 ? c.adSpend / c.clicks : 0
      const rows: FunnelStageRow[] = [
        { label: '노출', value: c.impressions, source: 'admin' },
        {
          label: '클릭', value: c.clicks, source: 'admin',
          prevLabel: '노출', conversionRate: safeRate(c.clicks, c.impressions),
          costPerAction: cpc, costLabel: 'CPC · 클릭당 광고비',
        },
        {
          label: '리드', value: c.leads, source: 'admin',
          prevLabel: '클릭', conversionRate: safeRate(c.leads, c.clicks),
          costPerAction: c.cpa_lead, costLabel: 'CPA · 리드 획득당 비용',
        },
        {
          label: reserveLabel, value: c.reservations, source: 'dummy',
          prevLabel: '리드', conversionRate: safeRate(c.reservations, c.leads),
          costPerAction: c.cpa_reservation,
          costLabel: is3550 ? '예약당 단가 · 지출 ÷ 예약' : '예약 획득비용 · 방문예약 1건당',
        },
        {
          label: contractLabel, value: c.contracts, source: 'dummy',
          prevLabel: reserveLabel, conversionRate: safeRate(c.contracts, c.reservations),
          costPerAction: c.cpa_contract,
          costLabel: is3550 ? '계약당 단가 · 지출 ÷ 계약' : '결제당 광고비용 · 결제 1건당',
        },
      ]
      return {
        channel: c.channel,
        rows,
        adSpend: c.adSpend,
        revenue: c.revenue,
        roas: c.roas,
      }
    })
  }, [data, eventId, sessionsByChannel])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">랜딩페이지 퍼널 — 이벤트 {eventId}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {data?.landingPaths?.map((p) => (
                  <span key={p} className="inline-block mr-2 bg-muted px-2 py-0.5 rounded text-xs font-mono">
                    heypick.co.kr{p}
                  </span>
                ))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm inline-flex items-center gap-1.5 text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeTest}
                  onChange={(e) => setExcludeTest(e.target.checked)}
                  className="rounded"
                />
                테스트 제외
              </label>
              <button
                type="button"
                onClick={() => setRefreshTick((t) => t + 1)}
                className="inline-flex items-center gap-1 text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-muted"
                title="새로고침"
              >
                <RefreshCw size={14} /> 새로고침
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e) }}
            />
            <div className="ml-auto flex gap-1">
              <button className="text-sm px-3 py-1.5 rounded-md bg-primary/10 text-primary font-medium">
                {DEFAULT_VIEW}
              </button>
              {DISABLED_VIEWS.map((v) => (
                <button
                  key={v}
                  disabled
                  title="Phase 2 예정"
                  className="text-sm px-3 py-1.5 rounded-md text-muted-foreground/50 cursor-not-allowed"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {data?.realDataNote && (
              <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5 inline-block">
                📊 광고 실데이터: {data.realDataNote.advertiser} · {data.realDataNote.period.startDate} ~ {data.realDataNote.period.endDate}
                <span className="text-blue-500/70 ml-1">(매체 자동 연동 전까지 하드코딩)</span>
              </div>
            )}
            {data?.leads.simulated && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 inline-block">
                🧪 리드·예약 더미 — 실 DB 연동 대기 (Phase 2)
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 space-y-5">
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
            <FunnelFlow
              stages={funnelStages}
              trueROAS={data.funnel.trueROAS_estimated}
              adSpend={data.funnel.adSpend}
              averageOrderValue={data.funnel.averageOrderValue}
              reservationRevenue={data.funnel.reservationRevenue}
            />

            <KpiGrid items={kpi} />

            {/* 추이 차트 + 채널 도넛 (2컬럼, lg 미만에서는 1열) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
              <TrendChart
                data={trendData}
                actions={<TrendGranularityToggle value={granularity} onChange={setGranularity} />}
              />
              <ChannelDonut rows={channelDonutRows} />
            </div>

            <TrackingCodeTable rows={data.byTrackingCode} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <SourceTable
                rows={data.ga4.bySource ?? []}
                unavailableReason={
                  data.ga4.unavailable
                    ? (data.ga4.reason === 'no_creds'
                        ? 'GA4 자격증명 (WIF) 셋업 후 활성화'
                        : data.ga4.reason)
                    : data.ga4.error
                }
              />
              <ClarityCard data={data.clarity} />
            </div>

            {channelFunnelTables.length > 0 ? (
              <div className={`grid grid-cols-1 gap-5 ${
                channelFunnelTables.length >= 2 ? 'xl:grid-cols-2' : ''
              }`}>
                {channelFunnelTables.map((t) => (
                  <FunnelMetricsTable
                    key={t.channel}
                    channel={t.channel as AdChannel}
                    title="채널별 퍼널"
                    rows={t.rows}
                    adSpend={t.adSpend}
                    revenue={t.revenue}
                    roas={t.roas}
                  />
                ))}
              </div>
            ) : (
              <FunnelMetricsTable
                rows={funnelMetricRows}
                adSpend={data.funnel.adSpend}
                revenue={data.funnel.reservationRevenue}
                roas={data.funnel.trueROAS_estimated}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
