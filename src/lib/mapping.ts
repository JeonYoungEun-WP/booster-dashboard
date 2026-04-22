/**
 * 부스터 솔루션 핵심 매핑 유틸
 *
 * 규칙 (사용자 합의):
 *   광고 캠페인명에 `#{eventId}_{trackingCode}` 토큰이 박힘.
 *   이 토큰이 광고 ↔ 리드 ↔ 예약을 잇는 유일한 조인 키.
 *
 *   예시:
 *     "39만원_1 #1042_f1219M1"   → eventId=1042, trackingCode=f1219M1
 *     "우수2 #1159_qU1Ckk3Jfb"  → eventId=1159, trackingCode=qU1Ckk3Jfb
 *     "신규9 #1159_nAKPaEmU6J"  → eventId=1159, trackingCode=nAKPaEmU6J
 *
 * 랜딩 URL 포맷:
 *   헤이픽:   heypick.co.kr/tasks/{eventId}
 *   리드프로: leadpro.kr/event/{eventId}
 *   (레거시 고정 슬러그는 별도 인자로 추가 경로 지정)
 */

export interface CampaignTag {
  eventId: string
  trackingCode: string
}

/**
 * 캠페인명에서 첫 번째 매칭되는 #{eventId}_{trackingCode} 토큰 추출.
 * 매치 없으면 null.
 *
 * - eventId: 숫자만 (정수)
 * - trackingCode: 영숫자 (대소문자 구분)
 */
export function parseCampaignTag(campaignName: string): CampaignTag | null {
  if (!campaignName) return null
  const m = campaignName.match(/#(\d+)_([A-Za-z0-9]+)/)
  if (!m) return null
  return { eventId: m[1], trackingCode: m[2] }
}

/**
 * 이벤트 ID + (옵션) 레거시 슬러그로부터 GA4 pagePath 필터 후보 생성.
 * GA4 의 pagePath 는 쿼리스트링을 포함하지 않으므로 BEGINS_WITH 로 매치.
 */
export function buildLandingUrls(eventId: string, legacySlug?: string): string[] {
  const paths = [
    `/tasks/${eventId}`,    // heypick.co.kr/tasks/{id}
    `/event/${eventId}`,    // leadpro.kr/event/{id}
  ]
  if (legacySlug) paths.push(`/${legacySlug}`)
  return paths
}

/**
 * eventId 또는 legacySlug 둘 중 하나라도 매치되는 캠페인 태그 필터.
 * - 정확한 eventId 일치 우선 (대소문자 구분)
 * - trackingCode 는 옵션: 주어지면 trackingCode 까지 일치해야 매치
 */
export function matchesEvent(
  tag: CampaignTag | null,
  eventId: string,
  trackingCode?: string,
): boolean {
  if (!tag) return false
  if (tag.eventId !== eventId) return false
  if (trackingCode && tag.trackingCode !== trackingCode) return false
  return true
}
