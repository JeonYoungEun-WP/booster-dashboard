/**
 * 이벤트 단위 풀 퍼널 분석 API
 *
 * GET /api/event-analytics
 *   ?eventId=1042              (필수)
 *   &legacySlug=nexentire_rental  (옵션 — 레거시 고정 슬러그 URL 추가 매치)
 *   &trackingCode=abc          (옵션 — 특정 광고세트로 좁힘)
 *   &startDate=2026-04-15      (옵션, 기본: 최근 7일)
 *   &endDate=2026-04-22
 *   &excludeTest=1             (옵션 — GA4 Headless 브라우저 제외)
 *
 * 응답:
 *   period, eventId, legacySlug, funnel, byTrackingCode,
 *   ga4, clarity, leads, ads  (각 소스 개별 에러 허용)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  hasGA4Creds,
  getEventTotals, getEventDaily, getEventBySource,
  type GA4PageTotals, type GA4DailyRow, type GA4SourceRow,
} from '@/src/lib/channels/ga4'
import {
  hasClarityCreds, getEventInsights, dateRangeToClarityDays, getClarityConsoleUrl,
  type ClarityResult,
} from '@/src/lib/channels/clarity'
import {
  getReservationStats, isLeadDataSimulated,
  type ReservationStats,
} from '@/src/lib/channels/leads'
import {
  getChannelSummary, getCampaignPerformance,
  type CampaignPerformance, type ChannelPerformance,
} from '@/src/lib/ad-data'
import { buildLandingUrls, buildEventFilterPatterns, parseCampaignTag } from '@/src/lib/mapping'
import {
  getEvent1042Campaigns,
  EVENT_1042_LEAD_TOTAL,
  EVENT_1042_PERIOD,
  EVENT_1042_TOTALS,
  EVENT_1042_REVENUE,
  EVENT_1042_TEMPLATE_PATHS,
  EVENT_1042_LEAD_TIMESTAMPS,
} from '@/src/lib/real-data/event-1042'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

function offsetDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function settled<T>(r: PromiseSettledResult<T>): AdapterResult<T> {
  if (r.status === 'fulfilled') return { ok: true, data: r.value }
  return { ok: false, error: (r.reason as Error)?.message ?? String(r.reason) }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }
  const legacySlug = searchParams.get('legacySlug') || undefined
  const trackingCode = searchParams.get('trackingCode') || undefined
  const startDate = searchParams.get('startDate') || offsetDate(7)
  const endDate = searchParams.get('endDate') || offsetDate(0)
  const excludeTest = searchParams.get('excludeTest') === '1'

  // 이벤트별 템플릿 경로 등록 (GA4 쿼리 제거 설정 대비 우회 필터)
  // 이벤트 1042 = 더블어스 = /tasks/8426 전용
  const templatePaths = eventId === '1042' ? EVENT_1042_TEMPLATE_PATHS : []

  const landingPaths = buildLandingUrls(eventId, legacySlug)
  const eventFilter = buildEventFilterPatterns(eventId, legacySlug, undefined, templatePaths)

  // ───── 병렬 페칭 ─────
  const ga4Creds = hasGA4Creds()
  const ga4Promise: Promise<{
    totals: GA4PageTotals
    daily: GA4DailyRow[]
    bySource: GA4SourceRow[]
  } | null> = ga4Creds
    ? Promise.all([
        getEventTotals(startDate, endDate, eventFilter.queryParam, eventFilter.legacyPathPrefixes, eventFilter.templatePathPrefixes, excludeTest),
        getEventDaily(startDate, endDate, eventFilter.queryParam, eventFilter.legacyPathPrefixes, eventFilter.templatePathPrefixes, excludeTest),
        getEventBySource(startDate, endDate, eventFilter.queryParam, eventFilter.legacyPathPrefixes, eventFilter.templatePathPrefixes, excludeTest),
      ]).then(([totals, daily, bySource]) => ({ totals, daily, bySource }))
    : Promise.resolve(null)

  const clarityPromise: Promise<ClarityResult> = hasClarityCreds()
    ? getEventInsights(eventId, legacySlug, dateRangeToClarityDays(startDate, endDate), templatePaths)
    : Promise.resolve({ unavailable: true as const, reason: 'no_creds' as const })

  const adsPromise: Promise<{
    byChannel: ChannelPerformance[]
    campaigns: CampaignPerformance[]
  }> = Promise.all([
    getChannelSummary({ startDate, endDate }),
    getCampaignPerformance({ startDate, endDate }),
  ]).then(([byChannel, campaigns]) => ({ byChannel, campaigns }))

  const [ga4Settled, claritySettled, adsSettled] = await Promise.allSettled([
    ga4Promise, clarityPromise, adsPromise,
  ])

  // ───── GA4 일별 세션을 리드 더미 생성 힌트로 사용 ─────
  const ga4Result = settled(ga4Settled)
  const sessionByDate: Record<string, number> = {}
  if (ga4Result.ok && ga4Result.data) {
    for (const row of ga4Result.data.daily) sessionByDate[row.date] = row.sessions
  }

  const clarityResult = settled(claritySettled)
  const adsResult = settled(adsSettled)

  // ───── 이벤트 매핑 : 캠페인 중 eventId 매치만 ─────
  let eventCampaigns: CampaignPerformance[] = []
  let unmappedChannelSummary: ChannelPerformance[] = []
  if (adsResult.ok) {
    eventCampaigns = adsResult.data.campaigns.filter((c) => {
      const tag = c.tag ?? parseCampaignTag(c.campaignName)
      if (!tag || tag.eventId !== eventId) return false
      if (trackingCode && tag.trackingCode !== trackingCode) return false
      return true
    })
    unmappedChannelSummary = adsResult.data.byChannel
  }

  // ───── 실데이터 override: 이벤트 1042 (더블어스) — 2026-03 광고 실적 ─────
  // 매체 API 자동 연동 전까지 광고주 제공 실수치 하드코딩. 기간 무관하게 주입.
  let realDataNote: { eventId: string; period: { startDate: string; endDate: string }; advertiser: string } | null = null
  let overrideLeadTotal: number | null = null
  if (eventId === '1042') {
    eventCampaigns = getEvent1042Campaigns()
    if (trackingCode) {
      eventCampaigns = eventCampaigns.filter((c) => c.tag?.trackingCode === trackingCode)
    }
    overrideLeadTotal = EVENT_1042_LEAD_TOTAL
    realDataNote = {
      eventId: '1042',
      period: EVENT_1042_PERIOD,
      advertiser: '더블어스',
    }
  }

  // 이벤트에 실제 매핑된 트래킹코드만 추출 — 리드·예약 더미가 이 코드들로 분배돼야 조인 성립.
  const eventTrackingCodes = Array.from(
    new Set(eventCampaigns.map((c) => c.tag?.trackingCode).filter(Boolean) as string[]),
  )

  // ───── 리드·예약 (더미) — 광고 결과의 트래킹코드 세트로 분배 ─────
  // 이벤트 1042: 실 리드 타임스탬프 + 예약 13건 override (주말 가중치 분배)
  const overrideReservationTotal = eventId === '1042'
    ? EVENT_1042_REVENUE.reservationCount
    : undefined
  const realTimestamps = eventId === '1042' ? EVENT_1042_LEAD_TIMESTAMPS : undefined

  let leadsResult: AdapterResult<ReservationStats>
  try {
    const stats = await getReservationStats(
      eventId, trackingCode, startDate, endDate, sessionByDate,
      eventTrackingCodes.length > 0 ? eventTrackingCodes : undefined,
      overrideLeadTotal ?? undefined,
      overrideReservationTotal,
      realTimestamps,
    )
    leadsResult = { ok: true, data: stats }
  } catch (e) {
    leadsResult = { ok: false, error: (e as Error).message }
  }

  // ───── 퍼널 수치 계산 ─────
  // 기본: 광고세트 합산값 사용.
  // 이벤트 1042 는 광고주 전체 집계값 (광고세트 합계 + 미매핑) 로 override.
  let adSpend = eventCampaigns.reduce((s, c) => s + c.cost, 0)
  const impressions = eventCampaigns.reduce((s, c) => s + c.impressions, 0)
  const clicks = eventCampaigns.reduce((s, c) => s + c.clicks, 0)

  if (eventId === '1042') {
    adSpend = EVENT_1042_TOTALS.spend   // 9,020,978 (광고주 전체 집계)
  }

  const ga4Totals = ga4Result.ok ? ga4Result.data?.totals : undefined
  const sessions = ga4Totals?.sessions ?? 0
  const pageViews = ga4Totals?.screenPageViews ?? 0

  const leads = leadsResult.ok ? leadsResult.data.leadCount : 0
  // 방문예약·결제·객단가·매출: 이벤트 1042 는 실데이터(더미) 고정,
  // 그 외 이벤트는 리드 어댑터 기반 비례 추정.
  let visitReservations = Math.round(leads * 0.10)        // 방문예약: 리드의 10% 기본 추정
  let reservations = leadsResult.ok ? leadsResult.data.reservationCount : 0
  let averageOrderValue = 280_000                         // 기본 객단가
  if (eventId === '1042') {
    visitReservations = EVENT_1042_REVENUE.visitReservationCount  // 41건
    reservations = EVENT_1042_REVENUE.reservationCount            // 13건 (결제)
    averageOrderValue = EVENT_1042_REVENUE.averageOrderValue      // 1,300,000원
  }
  const reservationRevenue = reservations * averageOrderValue

  const funnel = {
    adSpend,
    impressions,
    clicks,
    sessions,
    pageViews,
    leads,
    visitReservations,              // 방문예약 (상담 완료)
    reservations,                   // 결제 (최종 매출 발생)
    averageOrderValue,
    reservationRevenue,
    ctr:     impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc:     clicks > 0      ? adSpend / clicks            : 0,
    cpa_lead:             leads > 0             ? adSpend / leads             : 0,  // 리드 획득당 비용
    cpa_visitReservation: visitReservations > 0 ? adSpend / visitReservations : 0,  // 예약 획득비용 (방문예약당)
    cpa_reservation:      reservations > 0      ? adSpend / reservations      : 0,  // 결제당 광고비용
    cvr_click_to_session:         clicks > 0 ? sessions / clicks : 0,
    cvr_session_to_lead:          sessions > 0 ? leads / sessions : 0,
    cvr_lead_to_visitReservation: leads > 0 ? visitReservations / leads : 0,
    cvr_visitReservation_to_payment: visitReservations > 0 ? reservations / visitReservations : 0,
    cvr_lead_to_reservation:      leads > 0 ? reservations / leads : 0,
    trueROAS_estimated: adSpend > 0 ? reservationRevenue / adSpend : 0,
  }

  // ───── 트래킹코드 단위 집계 ─────
  const codeMap = new Map<string, {
    trackingCode: string
    adSpend: number
    impressions: number
    clicks: number
    leads: number
    reservations: number
  }>()
  for (const c of eventCampaigns) {
    const code = c.tag!.trackingCode
    const prev = codeMap.get(code) ?? { trackingCode: code, adSpend: 0, impressions: 0, clicks: 0, leads: 0, reservations: 0 }
    codeMap.set(code, {
      ...prev,
      adSpend: prev.adSpend + c.cost,
      impressions: prev.impressions + c.impressions,
      clicks: prev.clicks + c.clicks,
    })
  }
  if (leadsResult.ok) {
    for (const row of leadsResult.data.byTrackingCode) {
      const prev = codeMap.get(row.trackingCode) ?? {
        trackingCode: row.trackingCode, adSpend: 0, impressions: 0, clicks: 0, leads: 0, reservations: 0,
      }
      codeMap.set(row.trackingCode, {
        ...prev,
        leads: prev.leads + row.leads,
        reservations: prev.reservations + row.reservations,
      })
    }
  }
  // 이벤트 1042 의 경우 총 예약 수가 13 으로 강제되므로, 트래킹코드별 예약 분배를
  // 리드 비중에 따라 재계산 (전체 reservation sum === 13 이 되도록).
  if (eventId === '1042') {
    const entries = Array.from(codeMap.values())
    const totalLeadsByCode = entries.reduce((s, e) => s + e.leads, 0)
    const targetReservations = EVENT_1042_REVENUE.reservationCount
    if (totalLeadsByCode > 0) {
      let allocated = 0
      const sortedByLeads = [...entries].sort((a, b) => b.leads - a.leads)
      for (let i = 0; i < sortedByLeads.length; i++) {
        const row = sortedByLeads[i]
        const isLast = i === sortedByLeads.length - 1
        // 마지막 행은 차액으로 보정해 합계 정확히 13 유지
        const alloc = isLast
          ? targetReservations - allocated
          : Math.round((row.leads / totalLeadsByCode) * targetReservations)
        row.reservations = Math.max(0, alloc)
        allocated += row.reservations
      }
    }
  }

  const byTrackingCode = Array.from(codeMap.values())
    .map((r) => ({
      ...r,
      cpa_lead: r.leads > 0 ? r.adSpend / r.leads : 0,               // 리드 획득당 비용
      costPerReservation: r.reservations > 0 ? r.adSpend / r.reservations : 0,  // 예약 1건당 광고비
      reservationROAS: r.adSpend > 0 ? (r.reservations * averageOrderValue) / r.adSpend : 0,
    }))
    .sort((a, b) => b.adSpend - a.adSpend)

  return NextResponse.json({
    period: { startDate, endDate },
    eventId,
    legacySlug: legacySlug ?? null,
    trackingCode: trackingCode ?? null,
    landingPaths,
    realDataNote,
    funnel,
    byTrackingCode,
    ga4: ga4Result.ok
      ? (ga4Result.data
          ? {
              propertyId: process.env.GA4_PROPERTY_ID,
              totals: ga4Result.data.totals,
              daily: ga4Result.data.daily,
              bySource: ga4Result.data.bySource,
            }
          : { unavailable: true, reason: 'no_creds' })
      : { error: ga4Result.error },
    clarity: clarityResult.ok
      ? { ...clarityResult.data, consoleUrl: getClarityConsoleUrl() }
      : { error: clarityResult.error },
    leads: leadsResult.ok
      ? { ...leadsResult.data, simulated: isLeadDataSimulated() }
      : { error: leadsResult.error },
    ads: adsResult.ok
      ? {
          eventCampaigns,
          accountChannelSummary: unmappedChannelSummary,
          totalCampaignCount: adsResult.data.campaigns.length,
          eventCampaignCount: eventCampaigns.length,
        }
      : { error: adsResult.error },
  })
}
