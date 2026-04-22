/**
 * 이벤트 3550 (광고주: (주)굿리치 · "굿리치 보험료 절감") 실데이터 — 2026-03-22 ~ 2026-04-21
 *
 * 광고주 제공 엑셀(상세 14행, 메타 7 + 틱톡 7)을 하드코딩. 매체 API 자동 연동 전까지 사용.
 *
 * 원본 자료 (광고주 제공 엑셀 상세 행 기준):
 *   광고주명: (주)굿리치
 *   기간: 2026.3.22 ~ 4.21 (31일)
 *   노출: 241,877
 *   클릭: 2,533
 *   전환(리드) 합: 124       (E열)
 *   무효 DB 합: 13           (F열)
 *   예약 합: 27              (H열)  ← 예약 확정 건
 *   계약 합: 2               (J열)  ← 최종 계약 체결 = 매출 발생
 *   총 지출: 4,195,099
 *   객단가: 1,500,000 (광고주 지정 · 계약 1건당 매출)
 *   총 매출: 3,000,000 (= 계약 2 × 150만)
 *   수익: -1,195,099 (ROAS 71.5%)
 *
 * 퍼널 단계 (1042 와 필드 공유):
 *   funnel.leads              = 전환 124
 *   funnel.visitReservations  = 예약 27
 *   funnel.reservations       = 계약 2    ← 매출 인식 건수
 *   CPA 리드     = 지출 / 124
 *   예약당 단가   = 지출 / 27
 *   계약당 단가   = 지출 / 2
 *
 * 랜딩:
 *   heypick.co.kr/tasks/11924   (템플릿 경로)
 *   heypick.vercel.app/goodrich3 (레거시)
 *   leadpro.kr/event/3550       (리드프로)
 *
 * GA4 는 heypick.co.kr property 에 /tasks/19524 템플릿 트래킹이 안 붙어 있어 연동 불가.
 * 따라서 GA4 섹션은 이 파일이 제공하는 더미 세션/페이지뷰 데이터로 대체.
 * 더미 세션 총량은 광고 클릭(2,533)과 유사한 2,330 으로 설정.
 */

import type { AdChannel, CampaignPerformance } from '../ad-data'
import { parseCampaignTag } from '../mapping'
import type { GA4DailyRow, GA4PageTotals, GA4SourceRow } from '../channels/ga4'
import {
  EVENT_3550_LEAD_TIMESTAMPS,
  EVENT_3550_LEAD_COUNT,
  EVENT_3550_LEADS_BY_DATE,
  EVENT_3550_RESERVATION_TIMESTAMPS,
  EVENT_3550_RESERVATION_COUNT,
  EVENT_3550_RESERVATIONS_BY_DATE,
  EVENT_3550_BY_CHANNEL,
} from './event-3550-leads'

export {
  EVENT_3550_LEAD_TIMESTAMPS,
  EVENT_3550_LEAD_COUNT,
  EVENT_3550_LEADS_BY_DATE,
  EVENT_3550_RESERVATION_TIMESTAMPS,
  EVENT_3550_RESERVATION_COUNT,
  EVENT_3550_RESERVATIONS_BY_DATE,
  EVENT_3550_BY_CHANNEL,
}

export const EVENT_3550_PERIOD = { startDate: '2026-03-22', endDate: '2026-04-21' }

/** 이벤트 3550 레거시 랜딩 슬러그 (heypick.vercel.app/goodrich3). */
export const EVENT_3550_LEGACY_SLUG = 'goodrich3'

/** heypick 랜딩 템플릿 경로 (BEGINS_WITH 매칭용) — 현재 이벤트 전용. */
export const EVENT_3550_TEMPLATE_PATHS = ['/tasks/11924']

export const EVENT_3550_TOTALS = {
  spend: 4_195_099,                                           // 상세 14행 합계
  adSetSumSpend: 4_195_099,
  conversions: 124,                                           // 광고 측 전환 = 리드 카운트
  acquiredLeads: EVENT_3550_LEAD_COUNT,                       // 124
  invalidLeads: 13,                                           // 무료/무효 DB 합
  validLeads: EVENT_3550_LEAD_COUNT - 13,                     // 111
  impressions: 241_877,
  clicks: 2_533,
  cpa: Math.round(4_195_099 / 124),                           // 33,832
}

export const EVENT_3550_REVENUE = {
  visitReservationCount: 27,                                  // 예약 (H열)
  reservationCount: 2,                                        // 계약 (J열) — 매출 발생 건수
  averageOrderValue: 1_500_000,                               // 객단가 (광고주 지정)
  totalRevenue: 2 * 1_500_000,                                // 3,000,000 (계약 2 × 150만)
}

interface RawAdSet {
  channel: AdChannel
  code: string                // 생성 tracking code
  campaign: string            // 광고주 제공 캠페인 라벨
  spend: number
  conversions: number         // 전환(리드) 수 — E열
  invalidLeads: number        // 무효/무료 DB   — F열
  visitReservations: number   // 예약          — H열
  reservations: number        // 계약          — J열 (매출 발생)
  revenue: number             // 매출 = reservations × 1,500,000
}

// 엑셀 상세 14행 (엑셀 순서 유지)
const AD_SETS: RawAdSet[] = [
  { channel: 'meta',   code: 'gR8xPm21', campaign: '굿리치_보험다이어트솔루션_신세계_26_0323 (백사)', spend: 900_464, conversions: 25, invalidLeads: 2, visitReservations: 2, reservations: 1, revenue: 1_500_000 },
  { channel: 'meta',   code: 'hK7fQ9z3', campaign: '260415 굿리치 보험료 절감',                     spend: 475_336, conversions: 21, invalidLeads: 2, visitReservations: 6, reservations: 0, revenue: 0 },
  { channel: 'tiktok', code: 'tT4mP1x5', campaign: '260415 굿리치 보험료 절감',                     spend: 362_988, conversions: 12, invalidLeads: 5, visitReservations: 4, reservations: 1, revenue: 1_500_000 },
  { channel: 'tiktok', code: 'tY5nW3kL', campaign: '260408 굿리치 보험료 절감',                     spend: 283_832, conversions: 11, invalidLeads: 0, visitReservations: 4, reservations: 0, revenue: 0 },
  { channel: 'meta',   code: 'mU2sV6h7', campaign: '260407 굿리치 보험료 절감',                     spend: 380_054, conversions: 11, invalidLeads: 0, visitReservations: 3, reservations: 0, revenue: 0 },
  { channel: 'tiktok', code: 'tB3oH7t9', campaign: '260415 굿리치 보험료 절감',                     spend: 368_758, conversions:  9, invalidLeads: 0, visitReservations: 1, reservations: 0, revenue: 0 },
  { channel: 'meta',   code: 'mE9gJ8qN', campaign: '260407 굿리치 보험료 절감',                     spend: 385_597, conversions:  9, invalidLeads: 0, visitReservations: 2, reservations: 0, revenue: 0 },
  { channel: 'meta',   code: 'mF6iA2v4', campaign: '굿리치_시월리,신세계_26032_0',                   spend: 174_029, conversions:  7, invalidLeads: 0, visitReservations: 0, reservations: 0, revenue: 0 },
  { channel: 'meta',   code: 'mG1cR5u6', campaign: '굿리치_보험다이어트솔루션_신세계_26_0323',       spend: 321_464, conversions:  7, invalidLeads: 2, visitReservations: 1, reservations: 0, revenue: 0 },
  { channel: 'tiktok', code: 'tQ0pB4d8', campaign: '260415 굿리치 보험료 절감',                     spend: 255_471, conversions:  6, invalidLeads: 0, visitReservations: 3, reservations: 0, revenue: 0 },
  { channel: 'tiktok', code: 'tL2vC9mH', campaign: '굿리치_보험다이어트솔루션_신세계_26_0323',       spend:  78_898, conversions:  3, invalidLeads: 2, visitReservations: 0, reservations: 0, revenue: 0 },
  { channel: 'tiktok', code: 'tN4wD1jK', campaign: '260414 굿리치 보험료 절감',                     spend:  80_462, conversions:  1, invalidLeads: 0, visitReservations: 0, reservations: 0, revenue: 0 },
  { channel: 'meta',   code: 'mP5aF3rQ', campaign: '260414 굿리치 보험료 절감',                     spend:  73_393, conversions:  1, invalidLeads: 0, visitReservations: 0, reservations: 0, revenue: 0 },
  { channel: 'tiktok', code: 'tS6bX7yZ', campaign: '260415 굿리치 보험료 절감',                     spend:  54_353, conversions:  1, invalidLeads: 0, visitReservations: 1, reservations: 0, revenue: 0 },
]

/** 이벤트 3550 캠페인 목록 (14개 광고세트) — 노출·클릭은 광고세트 스펜드 비중으로 분배. */
export function getEvent3550Campaigns(): CampaignPerformance[] {
  const totalSpend = EVENT_3550_TOTALS.adSetSumSpend
  const { impressions: totalImp, clicks: totalClick } = EVENT_3550_TOTALS

  return AD_SETS.map((set) => {
    const share = set.spend / totalSpend
    const impressions = Math.round(totalImp * share)
    const clicks = Math.round(totalClick * share)
    const campaignName = `${set.campaign} #3550_${set.code}`

    return {
      channel: set.channel,
      campaignName,
      status: 'ACTIVE',
      tag: parseCampaignTag(campaignName),
      impressions,
      clicks,
      cost: set.spend,
      conversions: set.conversions,
      conversionValue: set.revenue,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? set.spend / clicks : 0,
      cpm: impressions > 0 ? (set.spend / impressions) * 1000 : 0,
      cvr: clicks > 0 ? (set.conversions / clicks) * 100 : 0,
      cpa: set.conversions > 0 ? set.spend / set.conversions : 0,
      roas: set.spend > 0 ? (set.revenue / set.spend) * 100 : 0,
    }
  })
}

/** 이벤트 3550 트래킹코드별 리드 분포 (conversions 비중). */
export function getEvent3550LeadDistribution(): Array<{
  trackingCode: string
  weight: number
  invalidCount: number
}> {
  const totalConv = AD_SETS.reduce((s, a) => s + a.conversions, 0)
  return AD_SETS.map((a) => ({
    trackingCode: a.code,
    weight: a.conversions / totalConv,
    invalidCount: a.invalidLeads,
  }))
}

/** 이벤트 3550 에 할당할 리드 총 건수 (실 DB 제출 수 = 타임스탬프 개수 124). */
export const EVENT_3550_LEAD_TOTAL = EVENT_3550_LEAD_COUNT

/** 쿼리 기간과 실데이터 기간(2026-03-22 ~ 4-21) 의 겹침 여부. */
export function doesQueryOverlapEvent3550Period(startDate: string, endDate: string): boolean {
  return startDate <= EVENT_3550_PERIOD.endDate && endDate >= EVENT_3550_PERIOD.startDate
}

// ───── GA4 더미 (heypick 템플릿 /tasks/19524 트래킹 미연동 → 클릭 수준 세션 주입) ─────

const GA4_SESSION_TOTAL = 2_330          // 클릭 2,533 대비 약 92% — 현실적 세션 규모
const GA4_PAGEVIEW_TOTAL = 2_915         // 세션당 1.25 페이지
const GA4_ACTIVE_USER_TOTAL = 2_105      // 세션당 0.90 활성 사용자

/** 각 날짜에 분배된 세션 수 (합 = GA4_SESSION_TOTAL), 리드 분포와 유사한 형태. */
function buildDailySessions(): Array<{ date: string; sessions: number; activeUsers: number; conversions: number }> {
  // 리드 ∪ 예약성공일 — trendChart x축에 예약만 있는 날(리드 0)도 포함되도록.
  const dates = Array.from(new Set([
    ...Object.keys(EVENT_3550_LEADS_BY_DATE),
    ...Object.keys(EVENT_3550_RESERVATIONS_BY_DATE),
  ])).sort()
  const totalLeads = EVENT_3550_LEAD_COUNT
  const leadShareByDate = dates.map((d) => (EVENT_3550_LEADS_BY_DATE[d] ?? 0) / totalLeads)
  // 세션 분배 = 리드 비중(85%) + 균등 베이스(15%)
  const uniformShare = 1 / dates.length
  let remainingSessions = GA4_SESSION_TOTAL
  let remainingUsers = GA4_ACTIVE_USER_TOTAL
  const rows: Array<{ date: string; sessions: number; activeUsers: number; conversions: number }> = []
  dates.forEach((date, i) => {
    const isLast = i === dates.length - 1
    const share = leadShareByDate[i] * 0.85 + uniformShare * 0.15
    const sessions = isLast ? remainingSessions : Math.round(GA4_SESSION_TOTAL * share)
    const activeUsers = isLast ? remainingUsers : Math.round(GA4_ACTIVE_USER_TOTAL * share)
    remainingSessions -= sessions
    remainingUsers -= activeUsers
    rows.push({
      date,
      sessions: Math.max(0, sessions),
      activeUsers: Math.max(0, activeUsers),
      conversions: EVENT_3550_LEADS_BY_DATE[date] ?? 0,
    })
  })
  return rows
}

const EVENT_3550_GA4_DAILY: GA4DailyRow[] = buildDailySessions()

/** 이벤트 3550 GA4 섹션 더미 — heypick 템플릿 /tasks/19524 미추적. */
export function getEvent3550Ga4Dummy(): {
  totals: GA4PageTotals
  daily: GA4DailyRow[]
  bySource: GA4SourceRow[]
} {
  const totals: GA4PageTotals = {
    sessions: GA4_SESSION_TOTAL,
    activeUsers: GA4_ACTIVE_USER_TOTAL,
    newUsers: Math.round(GA4_ACTIVE_USER_TOTAL * 0.78),
    conversions: EVENT_3550_LEAD_COUNT,
    totalRevenue: EVENT_3550_REVENUE.totalRevenue,
    engagementRate: 0.517,
    averageSessionDuration: 48,
    screenPageViews: GA4_PAGEVIEW_TOTAL,
  }

  // 매체별 분배: 메타/틱톡 지출 비중대로 (메타 2,710,337 / 틱톡 1,484,762)
  const metaSpend = AD_SETS.filter((a) => a.channel === 'meta').reduce((s, a) => s + a.spend, 0)
  const metaShare = metaSpend / EVENT_3550_TOTALS.adSetSumSpend
  const metaSessions = Math.round(GA4_SESSION_TOTAL * metaShare)
  const tiktokSessions = GA4_SESSION_TOTAL - metaSessions
  const metaConv = AD_SETS.filter((a) => a.channel === 'meta').reduce((s, a) => s + a.conversions, 0)
  const tiktokConv = EVENT_3550_LEAD_COUNT - metaConv

  const bySource: GA4SourceRow[] = [
    { source: 'facebook.com', medium: 'cpc', campaign: '(주)굿리치 · Meta', sessions: metaSessions, conversions: metaConv },
    { source: 'tiktok.com', medium: 'cpc', campaign: '(주)굿리치 · TikTok', sessions: tiktokSessions, conversions: tiktokConv },
  ]

  return { totals, daily: EVENT_3550_GA4_DAILY, bySource }
}
