/**
 * 스코프 단위 (브랜드 / 프로젝트 / 이벤트) 풀 퍼널 집계 서비스
 *
 * - event:   buildEventAnalytics 를 그대로 호출
 * - project: 프로젝트 내 모든 이벤트 분석 → 합산
 * - brand:   브랜드 내 모든 프로젝트 → 이벤트 → 합산
 *
 * 응답 스키마는 EventAnalyticsResponse 와 동일 유지 (UI 컴포넌트 그대로 재사용).
 */

import { buildEventAnalytics, type EventAnalyticsResponse } from './event-analytics-service'
import {
  getEventsForScope, resolveBreadcrumb, defaultDateRangeForScope,
  type ScopeType, type ScopeBreadcrumb,
} from './scope-catalog'

export interface ScopeAnalyticsParams {
  scope: ScopeType
  id: string
  startDate?: string
  endDate?: string
  excludeTest?: boolean
}

export interface ScopeAnalyticsResponse extends EventAnalyticsResponse {
  scope: ScopeType
  scopeId: string
  breadcrumb: ScopeBreadcrumb
  /** 집계 시 포함된 이벤트 ID 목록. */
  includedEventIds: string[]
}

/**
 * 두 byChannel 배열을 채널 키로 합산.
 */
function mergeByChannel(
  target: EventAnalyticsResponse['byChannel'],
  source: EventAnalyticsResponse['byChannel'],
): EventAnalyticsResponse['byChannel'] {
  const map = new Map<string, EventAnalyticsResponse['byChannel'][0]>()
  for (const row of target) map.set(row.channel, { ...row })
  for (const row of source) {
    const existing = map.get(row.channel)
    if (!existing) {
      map.set(row.channel, { ...row })
      continue
    }
    existing.adSpend += row.adSpend
    existing.impressions += row.impressions
    existing.clicks += row.clicks
    existing.leads += row.leads
    existing.reservations += row.reservations
    existing.contracts += row.contracts
    existing.revenue += row.revenue
    // 비율은 나중에 재계산 — 임시로 0
    existing.cpa_lead = existing.leads > 0 ? existing.adSpend / existing.leads : 0
    existing.cpa_reservation = existing.reservations > 0 ? existing.adSpend / existing.reservations : 0
    existing.cpa_contract = existing.contracts > 0 ? existing.adSpend / existing.contracts : 0
    existing.roas = existing.adSpend > 0 ? existing.revenue / existing.adSpend : 0
  }
  return Array.from(map.values()).sort((a, b) => b.leads - a.leads)
}

/**
 * byTrackingCode 합산 — 트래킹코드 중복되면 합산 (일반적으로 이벤트 간 코드 중복 없음).
 */
function mergeByTrackingCode(
  target: EventAnalyticsResponse['byTrackingCode'],
  source: EventAnalyticsResponse['byTrackingCode'],
): EventAnalyticsResponse['byTrackingCode'] {
  const map = new Map<string, EventAnalyticsResponse['byTrackingCode'][0]>()
  for (const row of target) map.set(row.trackingCode, { ...row })
  for (const row of source) {
    const existing = map.get(row.trackingCode)
    if (!existing) {
      map.set(row.trackingCode, { ...row })
      continue
    }
    existing.adSpend += row.adSpend
    existing.impressions += row.impressions
    existing.clicks += row.clicks
    existing.leads += row.leads
    existing.reservations += row.reservations
    existing.cpa_lead = existing.leads > 0 ? existing.adSpend / existing.leads : 0
    existing.costPerReservation = existing.reservations > 0 ? existing.adSpend / existing.reservations : 0
    // ROAS 는 기존 값 평균이 아닌, 새 adSpend/revenue 로 재계산해야 하나 revenue 가 여기 없음 → 가중 평균 유지
    const totalSpend = (existing.adSpend || 1)
    existing.reservationROAS =
      ((target.find((t) => t.trackingCode === row.trackingCode)?.reservationROAS ?? 0) * (totalSpend - row.adSpend) +
        row.reservationROAS * row.adSpend) / totalSpend
  }
  return Array.from(map.values()).sort((a, b) => b.adSpend - a.adSpend)
}

/**
 * leads.byDate / ga4.daily 등 일자별 시리즈 합산.
 * Key: date (YYYY-MM-DD).
 */
function mergeDailySeries<T extends { date: string }>(
  target: T[],
  source: T[],
  sumKeys: Array<keyof T>,
): T[] {
  const map = new Map<string, T>()
  for (const r of target) map.set(r.date, { ...r })
  for (const r of source) {
    const existing = map.get(r.date)
    if (!existing) {
      map.set(r.date, { ...r })
      continue
    }
    for (const k of sumKeys) {
      const a = existing[k] as unknown as number
      const b = r[k] as unknown as number
      ;(existing[k] as unknown as number) = (Number(a) || 0) + (Number(b) || 0)
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * GA4 bySource 합산 — source/medium/campaign 동일 키로 합산.
 */
interface Ga4SourceRow {
  source: string
  medium: string
  campaign: string
  sessions: number
  conversions: number
}

function mergeGa4BySource(target: Ga4SourceRow[], source: Ga4SourceRow[]): Ga4SourceRow[] {
  const map = new Map<string, Ga4SourceRow>()
  const keyFor = (r: Ga4SourceRow) => `${r.source}__${r.medium}__${r.campaign}`
  for (const r of target) map.set(keyFor(r), { ...r })
  for (const r of source) {
    const k = keyFor(r)
    const existing = map.get(k)
    if (!existing) {
      map.set(k, { ...r })
    } else {
      existing.sessions += r.sessions
      existing.conversions += r.conversions
    }
  }
  return Array.from(map.values()).sort((a, b) => b.sessions - a.sessions)
}

/**
 * scope 집계 — 여러 이벤트를 하나의 응답으로 합침.
 */
async function aggregateEvents(
  eventIds: string[],
  params: Omit<ScopeAnalyticsParams, 'scope' | 'id'>,
): Promise<EventAnalyticsResponse> {
  // 1) 각 이벤트 분석
  const results = await Promise.all(
    eventIds.map((eventId) => buildEventAnalytics({ eventId, ...params })),
  )

  if (results.length === 0) throw new Error('No events in scope')
  if (results.length === 1) return results[0]

  // 2) 합산 — funnel counters 부터
  const base = results[0]
  const merged: EventAnalyticsResponse = {
    ...base,
    landingPaths: Array.from(new Set(results.flatMap((r) => r.landingPaths))),
    realDataNote: null, // 스코프 수준에서는 단일 광고주 개념이 아님 — 호출자가 덮어씀
    funnel: { ...base.funnel },
    byChannel: [...base.byChannel],
    byTrackingCode: [...base.byTrackingCode],
  }

  for (let i = 1; i < results.length; i++) {
    const r = results[i]
    // 카운터 합산
    merged.funnel.adSpend += r.funnel.adSpend
    merged.funnel.impressions += r.funnel.impressions
    merged.funnel.clicks += r.funnel.clicks
    merged.funnel.sessions += r.funnel.sessions
    merged.funnel.pageViews += r.funnel.pageViews
    merged.funnel.leads += r.funnel.leads
    merged.funnel.visitReservations += r.funnel.visitReservations
    merged.funnel.reservations += r.funnel.reservations
    merged.funnel.reservationRevenue += r.funnel.reservationRevenue
    // AOV: 가중 평균 (결제 건 기준) — 마지막에 재계산

    merged.byChannel = mergeByChannel(merged.byChannel, r.byChannel)
    merged.byTrackingCode = mergeByTrackingCode(merged.byTrackingCode, r.byTrackingCode)
  }

  // 3) 비율 재계산 (합산된 카운터 기반)
  const f = merged.funnel
  f.ctr = f.impressions > 0 ? (f.clicks / f.impressions) * 100 : 0
  f.cpc = f.clicks > 0 ? f.adSpend / f.clicks : 0
  f.cpa_lead = f.leads > 0 ? f.adSpend / f.leads : 0
  f.cpa_visitReservation = f.visitReservations > 0 ? f.adSpend / f.visitReservations : 0
  f.cpa_reservation = f.reservations > 0 ? f.adSpend / f.reservations : 0
  f.cvr_click_to_session = f.clicks > 0 ? f.sessions / f.clicks : 0
  f.cvr_session_to_lead = f.sessions > 0 ? f.leads / f.sessions : 0
  f.cvr_lead_to_visitReservation = f.leads > 0 ? f.visitReservations / f.leads : 0
  f.cvr_visitReservation_to_payment = f.visitReservations > 0 ? f.reservations / f.visitReservations : 0
  f.cvr_lead_to_reservation = f.leads > 0 ? f.reservations / f.leads : 0
  f.trueROAS_estimated = f.adSpend > 0 ? f.reservationRevenue / f.adSpend : 0
  f.averageOrderValue = f.reservations > 0 ? f.reservationRevenue / f.reservations : 0

  // 4) GA4 · leads · clarity 서브섹션 합산
  // 4a) ga4
  const ga4Rows = results.map((r) => r.ga4 as {
    daily?: Array<{ date: string; sessions: number; activeUsers: number; conversions: number }>
    bySource?: Ga4SourceRow[]
    totals?: { sessions: number; screenPageViews: number; averageSessionDuration: number; engagementRate: number; conversions: number }
    simulated?: boolean
    unavailable?: boolean
    error?: string
  } | null)
  const allDaily = ga4Rows.reduce<Array<{ date: string; sessions: number; activeUsers: number; conversions: number }>>(
    (acc, g) => (g?.daily ? mergeDailySeries(acc, g.daily, ['sessions', 'activeUsers', 'conversions']) : acc),
    [],
  )
  const allSources = ga4Rows.reduce<Ga4SourceRow[]>(
    (acc, g) => (g?.bySource ? mergeGa4BySource(acc, g.bySource) : acc),
    [],
  )
  const totalSessions = allDaily.reduce((s, d) => s + d.sessions, 0)
  const totalConv = allDaily.reduce((s, d) => s + d.conversions, 0)
  const totalPageViews = ga4Rows.reduce((s, g) => s + (g?.totals?.screenPageViews ?? 0), 0)
  merged.ga4 = {
    daily: allDaily,
    bySource: allSources,
    totals: { sessions: totalSessions, screenPageViews: totalPageViews, averageSessionDuration: 0, engagementRate: 0, conversions: totalConv },
    simulated: ga4Rows.some((g) => g?.simulated),
    unavailable: ga4Rows.every((g) => g?.unavailable),
  }

  // 4b) leads
  const leadsRows = results.map((r) => r.leads as {
    leadCount?: number; reservationCount?: number
    byStatus?: Array<{ status: string; count: number }>
    byTrackingCode?: Array<{ trackingCode: string; leads: number; reservations: number }>
    byDate?: Array<{ date: string; leads: number; reservations: number }>
    simulated?: boolean
  } | null)
  const leadsDaily = leadsRows.reduce<Array<{ date: string; leads: number; reservations: number }>>(
    (acc, l) => (l?.byDate ? mergeDailySeries(acc, l.byDate, ['leads', 'reservations']) : acc),
    [],
  )
  const leadsByTrackingCode = leadsRows.flatMap((l) => l?.byTrackingCode ?? [])
  const statusMap = new Map<string, number>()
  for (const l of leadsRows) {
    for (const s of l?.byStatus ?? []) {
      statusMap.set(s.status, (statusMap.get(s.status) ?? 0) + s.count)
    }
  }
  merged.leads = {
    leadCount: leadsRows.reduce((s, l) => s + (l?.leadCount ?? 0), 0),
    reservationCount: leadsRows.reduce((s, l) => s + (l?.reservationCount ?? 0), 0),
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    byTrackingCode: leadsByTrackingCode,
    byDate: leadsDaily,
    simulated: leadsRows.some((l) => l?.simulated),
  }

  // 4c) clarity — 합산 어려움, 첫 번째 이벤트 값 유지 + unavailable 표기
  merged.clarity = results[0].clarity

  // 4d) ads
  merged.ads = results[0].ads // 광고 raw 데이터 — 대표값 (집계 없이)

  return merged
}

/**
 * Scope 단위 분석 진입점.
 */
export async function buildScopeAnalytics(
  params: ScopeAnalyticsParams,
): Promise<ScopeAnalyticsResponse> {
  const breadcrumb = resolveBreadcrumb(params.scope, params.id)
  if (!breadcrumb) {
    throw new Error(`Unknown scope: ${params.scope}/${params.id}`)
  }

  const events = getEventsForScope(params.scope, params.id)
  if (events.length === 0) {
    throw new Error(`No events in scope: ${params.scope}/${params.id}`)
  }

  // 기본 날짜 범위 보정
  const defaultRange = defaultDateRangeForScope(params.scope, params.id)
  const startDate = params.startDate ?? defaultRange.startDate
  const endDate = params.endDate ?? defaultRange.endDate

  // 단일 이벤트면 그대로 호출 — 가장 빠름
  if (params.scope === 'event') {
    const e = events[0]
    const base = await buildEventAnalytics({
      eventId: e.id, legacySlug: e.legacySlug, startDate, endDate, excludeTest: params.excludeTest,
    })
    return {
      ...base,
      scope: params.scope,
      scopeId: params.id,
      breadcrumb,
      includedEventIds: [e.id],
    }
  }

  // project / brand → 집계
  const base = await aggregateEvents(
    events.map((e) => e.id),
    { startDate, endDate, excludeTest: params.excludeTest },
  )

  // 스코프 수준의 "광고주" 개념 — breadcrumb.title 사용
  const overridden: EventAnalyticsResponse = {
    ...base,
    eventId: `${params.scope}:${params.id}`,
    legacySlug: null,
    trackingCode: null,
    period: { startDate, endDate },
    realDataNote: {
      eventId: `${params.scope}:${params.id}`,
      period: { startDate, endDate },
      advertiser: breadcrumb.title,
    },
  }

  return {
    ...overridden,
    scope: params.scope,
    scopeId: params.id,
    breadcrumb,
    includedEventIds: events.map((e) => e.id),
  }
}
