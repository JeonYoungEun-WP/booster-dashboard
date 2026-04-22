/**
 * 이벤트 1042 (광고주: 더블어스) 실데이터 — 2026-03-01 ~ 2026-03-31
 *
 * 매체(Meta) API 자동 연동 전까지 하드코딩. 매체 연동 파이프라인이 붙으면
 * 이 파일은 제거하고 실시간 수집으로 전환.
 *
 * 원본 자료 (광고주 제공):
 *   광고주명: 더블어스
 *   기간: 2026.3.1~31
 *   지출액: 9,020,978 (ad set 합계 8,994,811 + 미매핑 26,167)
 *   전환 단가: 21,077
 *   전환 수: 428  (광고측 트래킹 기준)
 *   획득한 리드: 441  (실제 DB 제출 수)
 *   노출: 260,137
 *   클릭: 7,829
 *
 * 광고세트별 — 모두 메타(Meta) 채널, 캠페인 '아웃@ A_W@ s2_눈밑지방재배치 39,59'
 */

import type { CampaignPerformance } from '../ad-data'
import { parseCampaignTag } from '../mapping'
import { EVENT_1042_LEAD_TIMESTAMPS, EVENT_1042_LEAD_COUNT } from './event-1042-leads'

export { EVENT_1042_LEAD_TIMESTAMPS, EVENT_1042_LEAD_COUNT }

export const EVENT_1042_PERIOD = { startDate: '2026-03-01', endDate: '2026-03-31' }

/**
 * 이벤트 1042 가 사용하는 heypick 랜딩 템플릿 경로.
 * 실제 URL: heypick.co.kr/tasks/8426/?event=1042&media=<x>
 *
 * GA4 가 쿼리 파라미터(`event=1042`)를 자동 제거해 저장하는 경우 대비,
 * 이 템플릿 경로 접두로 BEGINS_WITH 매칭해 트래픽 포집.
 *
 * 같은 템플릿을 다른 이벤트도 공유하면 과다 집계 가능 — 운영 시
 * 이벤트당 **고유 템플릿** 을 쓰거나, GA4 쿼리 보존 설정으로 해결.
 */
export const EVENT_1042_TEMPLATE_PATHS = ['/tasks/8426']

export const EVENT_1042_TOTALS = {
  spend: 9_020_978,                          // 광고주 전체 집계 (funnel.adSpend 에 이 값 사용)
  adSetSumSpend: 8_994_811,                  // 10개 광고세트 합계 (테이블 합계)
  conversions: 428,                          // 광고 측 전환 카운트
  acquiredLeads: EVENT_1042_LEAD_COUNT,      // 실 리드 DB 제출 수 (타임스탬프 배열 길이)
  invalidLeads: 82,                          // 무효 DB (광고주 집계 기준)
  validLeads: EVENT_1042_LEAD_COUNT - 82,
  impressions: 260_137,
  clicks: 7_829,
  cpa: 21_077,                               // 전환 단가 (광고주 집계)
}

// 매출 추정용 — 사용자 제공 더미 (매체 연동 전까지)
// 퍼널: 리드 441 → 방문예약 41 → 결제 13
export const EVENT_1042_REVENUE = {
  visitReservationCount: 41,       // 방문예약 (상담 통화 후 방문 확정) 더미
  reservationCount: 13,            // 결제 확정 건수 (최종 매출 발생) 더미
  averageOrderValue: 1_300_000,    // 객단가
  totalRevenue: 13 * 1_300_000,    // 16,900,000 (결제 기준)
}

interface RawAdSet {
  code: string          // tracking code (데모용 생성)
  spend: number
  conversions: number
  invalidLeads: number
  cpa: number
  invalidRate: number   // 0.0 ~ 1.0
}

// 광고세트 10개 — 스펜드 내림차순
const AD_SETS: RawAdSet[] = [
  { code: 'nA8xLm2p', spend: 2_343_697, conversions: 118, invalidLeads: 19, cpa: 19_862, invalidRate: 0.16 },
  { code: 'bK7fQ9zR', spend: 1_921_736, conversions: 93,  invalidLeads: 25, cpa: 20_664, invalidRate: 0.27 },
  { code: 'rT4mP1xC', spend: 1_569_935, conversions: 82,  invalidLeads: 17, cpa: 19_146, invalidRate: 0.21 },
  { code: 'eY5nW3kL', spend: 900_775,   conversions: 44,  invalidLeads: 6,  cpa: 20_472, invalidRate: 0.14 },
  { code: 'wU2sV6hD', spend: 779_522,   conversions: 38,  invalidLeads: 4,  cpa: 20_514, invalidRate: 0.11 },
  { code: 'xB3oH7tS', spend: 520_331,   conversions: 18,  invalidLeads: 6,  cpa: 28_907, invalidRate: 0.33 },
  { code: 'zE9gJ8qN', spend: 446_471,   conversions: 22,  invalidLeads: 4,  cpa: 20_294, invalidRate: 0.18 },
  { code: 'cF6iA2vM', spend: 412_717,   conversions: 10,  invalidLeads: 1,  cpa: 41_272, invalidRate: 0.10 },
  { code: 'yG1cR5uY', spend: 65_818,    conversions: 1,   invalidLeads: 0,  cpa: 65_818, invalidRate: 0.00 },
  { code: 'jQ0pB4dX', spend: 33_809,    conversions: 2,   invalidLeads: 0,  cpa: 16_904, invalidRate: 0.00 },
]

const CAMPAIGN_BASE_LABEL = '아웃@ A_W@ s2_눈밑지방재배치 39,59'

/**
 * 이벤트 1042 캠페인 목록 (광고세트 10개) 을 CampaignPerformance 포맷으로 반환.
 * 노출·클릭은 광고세트 스펜드 비중으로 총량 분배.
 */
export function getEvent1042Campaigns(): CampaignPerformance[] {
  const totalSpend = EVENT_1042_TOTALS.adSetSumSpend
  const { impressions: totalImp, clicks: totalClick } = EVENT_1042_TOTALS

  return AD_SETS.map((set) => {
    const share = set.spend / totalSpend
    const impressions = Math.round(totalImp * share)
    const clicks = Math.round(totalClick * share)
    const campaignName = `${CAMPAIGN_BASE_LABEL} #1042_${set.code}`

    return {
      channel: 'meta',
      campaignName,
      status: 'ACTIVE',
      tag: parseCampaignTag(campaignName),
      impressions,
      clicks,
      cost: set.spend,
      conversions: set.conversions,
      conversionValue: 0,                 // 광고주 측 매출값 미제공
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? set.spend / clicks : 0,
      cpm: impressions > 0 ? (set.spend / impressions) * 1000 : 0,
      cvr: clicks > 0 ? (set.conversions / clicks) * 100 : 0,
      cpa: set.cpa,
      roas: 0,                            // conversionValue=0 → 산출 불가
    }
  })
}

/**
 * 이벤트 1042 트래킹코드별 리드 분포 (conversions 비중).
 * leads.ts 가 더미 생성할 때 이 분포를 사용.
 */
export function getEvent1042LeadDistribution(): Array<{
  trackingCode: string
  weight: number       // 전체 리드 대비 비율 (합 = 1)
  invalidCount: number
}> {
  const totalConv = AD_SETS.reduce((s, a) => s + a.conversions, 0)
  return AD_SETS.map((a) => ({
    trackingCode: a.code,
    weight: a.conversions / totalConv,
    invalidCount: a.invalidLeads,
  }))
}

/** 이벤트 1042 에 할당할 리드 총 건수 (실 DB 제출 수 = 타임스탬프 개수) */
export const EVENT_1042_LEAD_TOTAL = EVENT_1042_LEAD_COUNT

/**
 * 쿼리 날짜 범위와 2026-03 월 데이터 기간의 겹침 여부.
 * 실데이터는 2026-03 전용이라 다른 기간엔 의미 없음.
 */
export function doesQueryOverlapEvent1042Period(startDate: string, endDate: string): boolean {
  return startDate <= EVENT_1042_PERIOD.endDate && endDate >= EVENT_1042_PERIOD.startDate
}
