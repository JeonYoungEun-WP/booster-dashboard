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
import { buildLandingUrls, parseCampaignTag } from '@/src/lib/mapping'
import {
  getEvent1042Campaigns,
  EVENT_1042_LEAD_TOTAL,
  EVENT_1042_PERIOD,
  EVENT_1042_TOTALS,
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

  const landingPaths = buildLandingUrls(eventId, legacySlug)

  // ───── 병렬 페칭 ─────
  const ga4Creds = hasGA4Creds()
  const ga4Promise: Promise<{
    totals: GA4PageTotals
    daily: GA4DailyRow[]
    bySource: GA4SourceRow[]
  } | null> = ga4Creds
    ? Promise.all([
        getEventTotals(startDate, endDate, landingPaths, excludeTest),
        getEventDaily(startDate, endDate, landingPaths, excludeTest),
        getEventBySource(startDate, endDate, landingPaths, excludeTest),
      ]).then(([totals, daily, bySource]) => ({ totals, daily, bySource }))
    : Promise.resolve(null)

  const clarityPromise: Promise<ClarityResult> = hasClarityCreds()
    ? getEventInsights(landingPaths, dateRangeToClarityDays(startDate, endDate))
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
  let leadsResult: AdapterResult<ReservationStats>
  try {
    const stats = await getReservationStats(
      eventId, trackingCode, startDate, endDate, sessionByDate,
      eventTrackingCodes.length > 0 ? eventTrackingCodes : undefined,
      overrideLeadTotal ?? undefined,
    )
    leadsResult = { ok: true, data: stats }
  } catch (e) {
    leadsResult = { ok: false, error: (e as Error).message }
  }

  // ───── 퍼널 수치 계산 ─────
  const adSpend = eventCampaigns.reduce((s, c) => s + c.cost, 0)
  const impressions = eventCampaigns.reduce((s, c) => s + c.impressions, 0)
  const clicks = eventCampaigns.reduce((s, c) => s + c.clicks, 0)

  const ga4Totals = ga4Result.ok ? ga4Result.data?.totals : undefined
  const sessions = ga4Totals?.sessions ?? 0
  const pageViews = ga4Totals?.screenPageViews ?? 0

  const leads = leadsResult.ok ? leadsResult.data.leadCount : 0
  const reservations = leadsResult.ok ? leadsResult.data.reservationCount : 0

  // 예약 1건의 추정 가치 (필요 시 향후 opts 로 받기). 시뮬레이션 기본값 = 280,000원
  const RESERVATION_VALUE = 280_000
  const reservationRevenue = reservations * RESERVATION_VALUE

  const funnel = {
    adSpend,
    impressions,
    clicks,
    sessions,
    pageViews,
    leads,
    reservations,
    reservationRevenue,
    ctr:     impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc:     clicks > 0      ? adSpend / clicks            : 0,
    cpl:     leads > 0       ? adSpend / leads             : 0,
    cpa_reservation: reservations > 0 ? adSpend / reservations : 0,
    cvr_click_to_session:   clicks > 0 ? sessions / clicks : 0,
    cvr_session_to_lead:    sessions > 0 ? leads / sessions : 0,
    cvr_lead_to_reservation: leads > 0 ? reservations / leads : 0,
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
  const byTrackingCode = Array.from(codeMap.values())
    .map((r) => ({
      ...r,
      cpl: r.leads > 0 ? r.adSpend / r.leads : 0,
      cpa_reservation: r.reservations > 0 ? r.adSpend / r.reservations : 0,
      reservationROAS: r.adSpend > 0 ? (r.reservations * RESERVATION_VALUE) / r.adSpend : 0,
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
