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
 * ⚠️ Deprecated — 실제 heypick 랜딩 URL 구조는
 *   heypick.co.kr/tasks/<템플릿ID>/?event=<이벤트ID>&media=<매체ID>
 * 이라 경로 기반 매칭으로는 정확한 필터링 불가.
 * 대신 buildEventFilterPatterns() 를 사용.
 *
 * 이 함수는 하위 호환용으로 남김 (표시 용도).
 */
export function buildLandingUrls(eventId: string, legacySlug?: string): string[] {
  const paths = [
    `heypick.co.kr/tasks/*/?event=${eventId}`,
    `leadpro.kr/event/*/?event=${eventId}`,
  ]
  if (legacySlug) paths.push(`heypick.co.kr/${legacySlug}`)
  return paths
}

/**
 * 이벤트 단위 URL 필터 패턴.
 *   - queryParam: pagePathPlusQueryString CONTAINS 용 (`event=<id>`)
 *   - legacyPathPrefixes: pagePath BEGINS_WITH 용 (구조 이전의 고정 슬러그)
 *   - mediaId 도 같이 좁히고 싶으면 extra 로 추가 필터
 */
export interface EventFilterPatterns {
  queryParam: string                  // "event=1042"
  mediaQueryParam?: string            // "media=1" (옵션)
  legacyPathPrefixes: string[]        // ["/nexentire_rental"] 등
}

export function buildEventFilterPatterns(
  eventId: string,
  legacySlug?: string,
  mediaId?: string,
): EventFilterPatterns {
  return {
    queryParam: `event=${eventId}`,
    mediaQueryParam: mediaId ? `media=${mediaId}` : undefined,
    legacyPathPrefixes: legacySlug ? [`/${legacySlug}`] : [],
  }
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
