'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { DateRangePicker } from '@/src/components/ui/DateRangePicker'
import { FunnelFlow } from '@/src/components/analytics/FunnelFlow'
import { KpiGrid } from '@/src/components/analytics/KpiGrid'
import { TrendChart, type TrendPoint } from '@/src/components/analytics/TrendChart'
import { TrackingCodeTable, type TrackingCodeRow } from '@/src/components/analytics/TrackingCodeTable'
import { SourceTable } from '@/src/components/analytics/SourceTable'
import { AdChannelMini } from '@/src/components/analytics/AdChannelMini'
import { ClarityCard, type ClarityCardData } from '@/src/components/analytics/ClarityCard'
import type { CampaignPerformance } from '@/src/lib/ad-data'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!eventId) return
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({
      eventId,
      startDate,
      endDate,
    })
    if (legacySlug) qs.set('legacySlug', legacySlug)
    if (excludeTest) qs.set('excludeTest', '1')

    fetch(`/api/event-analytics?${qs.toString()}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }))
          setError(err.error || err.hint || `HTTP ${r.status}`)
          return null
        }
        return r.json() as Promise<EventAnalyticsResponse>
      })
      .then((d) => setData(d))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [eventId, startDate, endDate, excludeTest, legacySlug, refreshTick])

  // 추이 데이터 = GA4 daily sessions + leads.byDate 에서 리드·예약 join
  const trendData: TrendPoint[] = useMemo(() => {
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

  const kpi = useMemo(() => {
    if (!data) return []
    const f = data.funnel
    const avgDuration = data.ga4.totals?.averageSessionDuration ?? 0
    // 퍼널 카드에 이미 표시되는 지표(리드·방문예약·결제·광고비·ROAS) 는 중복 제거
    return [
      { label: '페이지뷰', value: fmtNumber(f.pageViews), source: 'ga' as const },
      { label: '세션', value: fmtNumber(f.sessions), source: 'ga' as const },
      { label: '평균 체류', value: fmtDuration(avgDuration), source: 'ga' as const },
    ]
  }, [data])

  const funnelStages = useMemo(() => {
    if (!data) return []
    const f = data.funnel
    return [
      { label: '노출',     value: f.impressions,      source: 'admin' as const },
      { label: '클릭',     value: f.clicks,           source: 'admin' as const,
        cpu: f.cpc,                 cpuLabel: 'CPC · 클릭당 광고비' },
      { label: '세션',     value: f.sessions,         source: 'ga' as const },
      { label: '리드',     value: f.leads,            source: 'admin' as const,
        cpu: f.cpa_lead,            cpuLabel: 'CPA · 리드 획득당 비용' },
      { label: '방문예약', value: f.visitReservations,source: 'dummy' as const,
        cpu: f.cpa_visitReservation,cpuLabel: '예약 획득비용 · 방문예약 1건당' },
      { label: '결제',     value: f.reservations,     source: 'dummy' as const,
        cpu: f.cpa_reservation,     cpuLabel: '결제당 광고비용 · 결제 1건당' },
    ]
  }, [data])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold">랜딩페이지 퍼널 — 이벤트 {eventId}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data?.landingPaths?.map((p) => (
                  <span key={p} className="inline-block mr-2 bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                    heypick.co.kr{p}
                  </span>
                ))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs inline-flex items-center gap-1.5 text-muted-foreground cursor-pointer">
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
                className="inline-flex items-center gap-1 text-xs rounded-md border border-border px-2 py-1.5 hover:bg-muted"
                title="새로고침"
              >
                <RefreshCw size={13} /> 새로고침
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
              <button className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary font-medium">
                {DEFAULT_VIEW}
              </button>
              {DISABLED_VIEWS.map((v) => (
                <button
                  key={v}
                  disabled
                  title="Phase 2 예정"
                  className="text-xs px-2.5 py-1 rounded-md text-muted-foreground/50 cursor-not-allowed"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {data?.realDataNote && (
              <div className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1.5 inline-block">
                📊 광고 실데이터: {data.realDataNote.advertiser} · {data.realDataNote.period.startDate} ~ {data.realDataNote.period.endDate}
                <span className="text-blue-500/70 ml-1">(매체 자동 연동 전까지 하드코딩)</span>
              </div>
            )}
            {data?.leads.simulated && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 inline-block">
                🧪 리드·예약 더미 — 실 DB 연동 대기 (Phase 2)
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 space-y-5">
        {loading && !data && (
          <div className="text-center text-muted-foreground py-20">데이터를 불러오는 중...</div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
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

            <TrendChart data={trendData} />

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

            <AdChannelMini eventCampaigns={data.ads.eventCampaigns ?? []} />
          </>
        )}
      </div>
    </div>
  )
}
