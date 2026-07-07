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
  getEvent1042LeadDistribution,
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
  getEvent3550LeadDistribution,
  getEvent3550TrackingCodePerformance,
  EVENT_3550_LEAD_TOTAL,
  EVENT_3550_PERIOD,
  EVENT_3550_TOTALS,
  EVENT_3550_REVENUE,
  EVENT_3550_RESERVATION_COUNT,
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

/**
 * 총량 `total` 을 가중치 배열에 largest-remainder 방식으로 분배.
 * floor 후 소수부가 큰 순서로 +1 씩 배정 — 합 보존, 음수·초과 없음.
 * 반환: weights 와 같은 길이의 정수 배열.
 */
function largestRemainderAllocate(total: number, weights: number[]): number[] {
  const n = weights.length
  if (n === 0) return []
  if (total <= 0) return weights.map(() => 0)
  const totalWeight = weights.reduce((s, w) => s + Math.max(0, w), 0)
  if (totalWeight <= 0) return weights.map((_, i) => (i === 0 ? total : 0))
  const floats = weights.map((w) => (total * Math.max(0, w)) / totalWeight)
  const floors = floats.map(Math.floor)
  const sum = floors.reduce((s, v) => s + v, 0)
  const remainder = total - sum
  const order = weights
    .map((_, i) => i)
    .sort((a, b) => (floats[b] - floors[b]) - (floats[a] - floors[a]))
  const result = [...floors]
  for (let i = 0; i < remainder && i < order.length; i++) result[order[i]] += 1
  return result
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
    reservations: number       // 중간 단계 (예약 / 방문예약)
    contracts: number          // 최종 단계 (계약 / 결제 · 매출 발생)
    cpa_lead: number
    costPerReservation: number // 예약 1건당 광고비
    costPerContract: number    // 계약(결제) 1건당 광고비
    contractROAS: number       // 계약 매출 ÷ 광고비 (contracts × AOV / adSpend)
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

  // 예약 총수(leads.reservationCount 및 byDate 합) 의 의미:
  //   - 1042: 결제 13 (byDate·reservationCount 모두 결제 기준, 실 방문예약 타임스탬프 미제공)
  //   - 3550: 예약 27 (byDate 는 EVENT_3550_RESERVATIONS_BY_DATE 로 덮어써 합 27 → reservationCount 도 27 로 정합)
  //     계약 2 는 funnel.reservations · byTrackingCode.contracts 로만 표현.
  const overrideReservationTotal = eventId === '1042'
    ? EVENT_1042_REVENUE.reservationCount
    : eventId === '3550'
      ? EVENT_3550_RESERVATION_COUNT
      : undefined
  const realTimestamps = eventId === '1042' ? EVENT_1042_LEAD_TIMESTAMPS
    : eventId === '3550' ? EVENT_3550_LEAD_TIMESTAMPS
    : undefined

  // 리드 비중 분배 — 코드별 실측 conversions 비중으로 리드를 배정 (균등 분배 대체, 버그 C).
  const codeWeights = eventId === '1042' ? getEvent1042LeadDistribution().map((d) => ({ trackingCode: d.trackingCode, weight: d.weight }))
    : eventId === '3550' ? getEvent3550LeadDistribution().map((d) => ({ trackingCode: d.trackingCode, weight: d.weight }))
    : undefined

  let leadsResult: AdapterResult<ReservationStats>
  try {
    const stats = await getReservationStats(
      eventId, trackingCode, startDate, endDate, sessionByDate,
      eventTrackingCodes.length > 0 ? eventTrackingCodes : undefined,
      overrideLeadTotal ?? undefined,
      overrideReservationTotal,
      realTimestamps,
      codeWeights,
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
    // reservationCount 도 byDate 합(=예약 실측 27)으로 정합.
    // (leads 어댑터의 주말가중 분배는 날짜별 리드수 상한에 걸려 27 미달이 될 수 있어 실측으로 덮어씀)
    leadsResult.data.reservationCount = leadsResult.data.byDate.reduce((s, d) => s + d.reservations, 0)
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
    reservations: number       // 중간 단계 (예약 / 방문예약)
    contracts: number          // 최종 단계 (계약 / 결제 · 매출 발생)
  }>()
  for (const c of eventCampaigns) {
    const code = c.tag!.trackingCode
    const prev = codeMap.get(code) ?? { trackingCode: code, adSpend: 0, impressions: 0, clicks: 0, leads: 0, reservations: 0, contracts: 0 }
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
        trackingCode: row.trackingCode, adSpend: 0, impressions: 0, clicks: 0, leads: 0, reservations: 0, contracts: 0,
      }
      codeMap.set(row.trackingCode, {
        ...prev,
        leads: prev.leads + row.leads,
        reservations: prev.reservations + row.reservations,
      })
    }
  }
  // 코드별 예약·계약 확정:
  //   - 3550: 엑셀 상세 14행 실측(leads·예약·계약)을 코드별로 직접 덮어씀
  //     (codeMap 에 없으면 생성; adSpend·노출·클릭은 캠페인 쪽 값 유지)
  //   - 1042: 코드별 실측 없음 → largest-remainder 로 총 예약 41 / 총 계약 13 을 leads 비중 분배
  //   - 일반: leads 어댑터의 예약완료 수(reservations) 유지, 계약은 실측 구분이 없어 예약과 동일 처리
  if (eventId === '3550') {
    for (const perf of getEvent3550TrackingCodePerformance()) {
      const prev = codeMap.get(perf.trackingCode) ?? {
        trackingCode: perf.trackingCode, adSpend: 0, impressions: 0, clicks: 0, leads: 0, reservations: 0, contracts: 0,
      }
      codeMap.set(perf.trackingCode, {
        ...prev,
        leads: perf.leads,
        reservations: perf.reservations,
        contracts: perf.contracts,
      })
    }
  } else if (eventId === '1042') {
    const entries = Array.from(codeMap.values())
    const leadWeights = entries.map((e) => e.leads)
    const resAlloc = largestRemainderAllocate(EVENT_1042_REVENUE.visitReservationCount, leadWeights)
    const contractAlloc = largestRemainderAllocate(EVENT_1042_REVENUE.reservationCount, leadWeights)
    entries.forEach((e, i) => {
      e.reservations = resAlloc[i]
      e.contracts = contractAlloc[i]
    })
  } else {
    // 더미 데이터라 예약/계약 실측 구분이 없어 계약 = 예약(예약완료 상태 수)
    for (const e of codeMap.values()) e.contracts = e.reservations
  }

  const byTrackingCode = Array.from(codeMap.values())
    .map((r) => ({
      ...r,
      cpa_lead: r.leads > 0 ? r.adSpend / r.leads : 0,
      costPerReservation: r.reservations > 0 ? r.adSpend / r.reservations : 0,
      costPerContract: r.contracts > 0 ? r.adSpend / r.contracts : 0,
      contractROAS: r.adSpend > 0 ? (r.contracts * averageOrderValue) / r.adSpend : 0,
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
