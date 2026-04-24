/**
 * 이벤트 단위 풀 퍼널 분석 — 공유 서비스 함수
 *
 * /api/event-analytics 라우트와 /api/ad-chat AI 도구가 공유.
 * HTTP 호출 없이 같은 로직을 재사용하여 Vercel Deployment Protection
 * 우회나 bypass secret 없이 동작.
 */

import {
  hasGA4Creds,
  getEventTotals, getEventDaily, getEventBySource,
  type GA4PageTotals, type GA4DailyRow, type GA4SourceRow,
} from './channels/ga4'
import {
  hasClarityCreds, getEventInsights, dateRangeToClarityDays, getClarityConsoleUrl,
  type ClarityResult,
} from './channels/clarity'
import {
  getReservationStats, isLeadDataSimulated,
  type ReservationStats,
} from './channels/leads'
import {
  getChannelSummary, getCampaignPerformance,
  type CampaignPerformance, type ChannelPerformance,
} from './ad-data'
import { buildLandingUrls, buildEventFilterPatterns, parseCampaignTag } from './mapping'
import {
  getEvent1042Campaigns,
  EVENT_1042_LEAD_TOTAL,
  EVENT_1042_PERIOD,
  EVENT_1042_TOTALS,
  EVENT_1042_REVENUE,
  EVENT_1042_TEMPLATE_PATHS,
  EVENT_1042_LEAD_TIMESTAMPS,
} from './real-data/event-1042'
import {
  getEvent3550Campaigns,
  getEvent3550Ga4Dummy,
  EVENT_3550_LEAD_TOTAL,
  EVENT_3550_PERIOD,
  EVENT_3550_TOTALS,
  EVENT_3550_REVENUE,
  EVENT_3550_TEMPLATE_PATHS,
  EVENT_3550_LEAD_TIMESTAMPS,
  EVENT_3550_LEGACY_SLUG,
  EVENT_3550_LEADS_BY_DATE,
  EVENT_3550_RESERVATIONS_BY_DATE,
  EVENT_3550_BY_CHANNEL,
} from './real-data/event-3550'

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

export interface EventAnalyticsParams {
  eventId: string
  legacySlug?: string
  trackingCode?: string
  startDate?: string
  endDate?: string
  excludeTest?: boolean
}

export interface EventAnalyticsResponse {
  period: { startDate: string; endDate: string }
  eventId: string
  legacySlug: string | null
  trackingCode: string | null
  landingPaths: string[]
  realDataNote: { eventId: string; period: { startDate: string; endDate: string }; advertiser: string } | null
  funnel: {
    adSpend: number
    impressions: number
    clicks: number
    sessions: number
    pageViews: number
    leads: number
    visitReservations: number
    reservations: number
    averageOrderValue: number
    reservationRevenue: number
    ctr: number
    cpc: number
    cpa_lead: number
    cpa_visitReservation: number
    cpa_reservation: number
    cvr_click_to_session: number
    cvr_session_to_lead: number
    cvr_lead_to_visitReservation: number
    cvr_visitReservation_to_payment: number
    cvr_lead_to_reservation: number
    trueROAS_estimated: number
  }
  byChannel: Array<{
    channel: string
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
  }>
  byTrackingCode: Array<{
    trackingCode: string
    adSpend: number
    impressions: number
    clicks: number
    leads: number
    reservations: number
    cpa_lead: number
    costPerReservation: number
    reservationROAS: number
  }>
  ga4: unknown
  clarity: unknown
  leads: unknown
  ads: unknown
}

/**
 * 이벤트 풀 퍼널 분석 데이터 빌더.
 * /api/event-analytics route 와 /api/ad-chat AI 도구 공유.
 */
export async function buildEventAnalytics(
  params: EventAnalyticsParams,
): Promise<EventAnalyticsResponse> {
  const { eventId } = params
  const legacySlug = params.legacySlug
    ?? (eventId === '3550' ? EVENT_3550_LEGACY_SLUG : undefined)
  const trackingCode = params.trackingCode
  const startDate = params.startDate ?? offsetDate(7)
  const endDate = params.endDate ?? offsetDate(0)
  const excludeTest = params.excludeTest ?? false

  const templatePaths = eventId === '1042' ? EVENT_1042_TEMPLATE_PATHS
    : eventId === '3550' ? EVENT_3550_TEMPLATE_PATHS
    : []

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

  const ga4Result = settled(ga4Settled)
  const sessionByDate: Record<string, number> = {}
  if (ga4Result.ok && ga4Result.data) {
    for (const row of ga4Result.data.daily) sessionByDate[row.date] = row.sessions
  }

  const clarityResult = settled(claritySettled)
  const adsResult = settled(adsSettled)

  // 이벤트 매핑
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

  // 실데이터 override (1042·3550)
  let realDataNote: { eventId: string; period: { startDate: string; endDate: string }; advertiser: string } | null = null
  let overrideLeadTotal: number | null = null
  if (eventId === '1042') {
    eventCampaigns = getEvent1042Campaigns()
    if (trackingCode) eventCampaigns = eventCampaigns.filter((c) => c.tag?.trackingCode === trackingCode)
    overrideLeadTotal = EVENT_1042_LEAD_TOTAL
    realDataNote = { eventId: '1042', period: EVENT_1042_PERIOD, advertiser: '더블어스' }
  } else if (eventId === '3550') {
    eventCampaigns = getEvent3550Campaigns()
    if (trackingCode) eventCampaigns = eventCampaigns.filter((c) => c.tag?.trackingCode === trackingCode)
    overrideLeadTotal = EVENT_3550_LEAD_TOTAL
    realDataNote = { eventId: '3550', period: EVENT_3550_PERIOD, advertiser: '(주)굿리치' }
  }

  const eventTrackingCodes = Array.from(
    new Set(eventCampaigns.map((c) => c.tag?.trackingCode).filter(Boolean) as string[]),
  )

  const overrideReservationTotal = eventId === '1042'
    ? EVENT_1042_REVENUE.reservationCount
    : eventId === '3550'
      ? EVENT_3550_REVENUE.reservationCount
      : undefined
  const realTimestamps = eventId === '1042' ? EVENT_1042_LEAD_TIMESTAMPS
    : eventId === '3550' ? EVENT_3550_LEAD_TIMESTAMPS
    : undefined

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

  // 3550 byDate 엑셀 실 분포 override
  if (eventId === '3550' && leadsResult.ok) {
    const allDates = new Set<string>([
      ...Object.keys(EVENT_3550_LEADS_BY_DATE),
      ...Object.keys(EVENT_3550_RESERVATIONS_BY_DATE),
    ])
    leadsResult.data.byDate = Array.from(allDates).sort().map((date) => ({
      date,
      leads: EVENT_3550_LEADS_BY_DATE[date] ?? 0,
      reservations: EVENT_3550_RESERVATIONS_BY_DATE[date] ?? 0,
    }))
  }

  // 퍼널 수치
  let adSpend = eventCampaigns.reduce((s, c) => s + c.cost, 0)
  const impressions = eventCampaigns.reduce((s, c) => s + c.impressions, 0)
  const clicks = eventCampaigns.reduce((s, c) => s + c.clicks, 0)

  if (eventId === '1042') adSpend = EVENT_1042_TOTALS.spend
  else if (eventId === '3550') adSpend = EVENT_3550_TOTALS.spend

  const ga4DummyFor3550 = eventId === '3550' ? getEvent3550Ga4Dummy() : null
  const ga4Totals = ga4DummyFor3550?.totals ?? (ga4Result.ok ? ga4Result.data?.totals : undefined)
  const sessions = ga4Totals?.sessions ?? 0
  const pageViews = ga4Totals?.screenPageViews ?? 0

  const leads = leadsResult.ok ? leadsResult.data.leadCount : 0
  let visitReservations = Math.round(leads * 0.10)
  let reservations = leadsResult.ok ? leadsResult.data.reservationCount : 0
  let averageOrderValue = 280_000
  if (eventId === '1042') {
    visitReservations = EVENT_1042_REVENUE.visitReservationCount
    reservations = EVENT_1042_REVENUE.reservationCount
    averageOrderValue = EVENT_1042_REVENUE.averageOrderValue
  } else if (eventId === '3550') {
    visitReservations = EVENT_3550_REVENUE.visitReservationCount
    reservations = EVENT_3550_REVENUE.reservationCount
    averageOrderValue = EVENT_3550_REVENUE.averageOrderValue
  }
  const reservationRevenue = reservations * averageOrderValue

  const funnel = {
    adSpend, impressions, clicks, sessions, pageViews,
    leads, visitReservations, reservations,
    averageOrderValue, reservationRevenue,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? adSpend / clicks : 0,
    cpa_lead:             leads > 0             ? adSpend / leads             : 0,
    cpa_visitReservation: visitReservations > 0 ? adSpend / visitReservations : 0,
    cpa_reservation:      reservations > 0      ? adSpend / reservations      : 0,
    cvr_click_to_session:            clicks > 0 ? sessions / clicks : 0,
    cvr_session_to_lead:             sessions > 0 ? leads / sessions : 0,
    cvr_lead_to_visitReservation:    leads > 0 ? visitReservations / leads : 0,
    cvr_visitReservation_to_payment: visitReservations > 0 ? reservations / visitReservations : 0,
    cvr_lead_to_reservation:         leads > 0 ? reservations / leads : 0,
    trueROAS_estimated: adSpend > 0 ? reservationRevenue / adSpend : 0,
  }

  // 트래킹코드 단위
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
  if (eventId === '1042' || eventId === '3550') {
    const entries = Array.from(codeMap.values())
    const totalLeadsByCode = entries.reduce((s, e) => s + e.leads, 0)
    const targetReservations = eventId === '1042'
      ? EVENT_1042_REVENUE.reservationCount
      : EVENT_3550_REVENUE.reservationCount
    if (totalLeadsByCode > 0) {
      let allocated = 0
      const sortedByLeads = [...entries].sort((a, b) => b.leads - a.leads)
      for (let i = 0; i < sortedByLeads.length; i++) {
        const row = sortedByLeads[i]
        const isLast = i === sortedByLeads.length - 1
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
      cpa_lead: r.leads > 0 ? r.adSpend / r.leads : 0,
      costPerReservation: r.reservations > 0 ? r.adSpend / r.reservations : 0,
      reservationROAS: r.adSpend > 0 ? (r.reservations * averageOrderValue) / r.adSpend : 0,
    }))
    .sort((a, b) => b.adSpend - a.adSpend)

  // 채널별 풀 퍼널
  const channelMap = new Map<string, {
    channel: string; adSpend: number; impressions: number; clicks: number;
    leads: number; reservations: number; contracts: number;
  }>()
  for (const c of eventCampaigns) {
    const prev = channelMap.get(c.channel) ?? {
      channel: c.channel, adSpend: 0, impressions: 0, clicks: 0,
      leads: 0, reservations: 0, contracts: 0,
    }
    channelMap.set(c.channel, {
      ...prev,
      adSpend: prev.adSpend + c.cost,
      impressions: prev.impressions + c.impressions,
      clicks: prev.clicks + c.clicks,
    })
  }
  if (eventId === '3550') {
    for (const ch of ['meta', 'tiktok'] as const) {
      const agg = channelMap.get(ch)
      if (agg) {
        agg.leads = EVENT_3550_BY_CHANNEL[ch].leads
        agg.reservations = EVENT_3550_BY_CHANNEL[ch].reservations
        agg.contracts = EVENT_3550_BY_CHANNEL[ch].contracts
      }
    }
  } else if (eventId === '1042') {
    const meta = channelMap.get('meta')
    if (meta) {
      meta.leads = leads
      meta.reservations = visitReservations
      meta.contracts = reservations
    }
  } else if (leadsResult.ok) {
    const totalSpend = Array.from(channelMap.values()).reduce((s, v) => s + v.adSpend, 0)
    for (const v of channelMap.values()) {
      const share = totalSpend > 0 ? v.adSpend / totalSpend : 0
      v.leads = Math.round(leads * share)
      v.reservations = Math.round(visitReservations * share)
      v.contracts = Math.round(reservations * share)
    }
  }
  const byChannel = Array.from(channelMap.values())
    .map((v) => ({
      ...v,
      revenue: v.contracts * averageOrderValue,
      cpa_lead: v.leads > 0 ? v.adSpend / v.leads : 0,
      cpa_reservation: v.reservations > 0 ? v.adSpend / v.reservations : 0,
      cpa_contract: v.contracts > 0 ? v.adSpend / v.contracts : 0,
      roas: v.adSpend > 0 ? (v.contracts * averageOrderValue) / v.adSpend : 0,
    }))
    .sort((a, b) => b.adSpend - a.adSpend)

  return {
    period: { startDate, endDate },
    eventId,
    legacySlug: legacySlug ?? null,
    trackingCode: trackingCode ?? null,
    landingPaths,
    realDataNote,
    funnel,
    byChannel,
    byTrackingCode,
    ga4: ga4DummyFor3550
      ? {
          propertyId: 'dummy-3550',
          totals: ga4DummyFor3550.totals,
          daily: ga4DummyFor3550.daily,
          bySource: ga4DummyFor3550.bySource,
          simulated: true,
          reason: 'heypick 템플릿 /tasks/19524 미추적 — 광고 클릭 기반 더미',
        }
      : ga4Result.ok
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
  }
}
