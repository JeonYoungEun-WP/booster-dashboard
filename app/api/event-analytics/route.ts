/**
 * 이벤트 단위 풀 퍼널 분석 API — 얇은 래퍼
 *
 * 실제 로직은 src/lib/event-analytics-service.ts 의 buildEventAnalytics() 에 있음.
 * 이 라우트는 쿼리 파싱 → 서비스 호출 → NextResponse 감싸기 만 담당.
 *
 * AI 챗(/api/ad-chat) 의 getEventFunnel 도구는 서비스 함수를 직접 호출하여
 * HTTP hop 과 Vercel Deployment Protection 우회 이슈를 회피.
 *
 * GET /api/event-analytics
 *   ?eventId=1042              (필수)
 *   &legacySlug=doubleus       (옵션)
 *   &trackingCode=abc          (옵션)
 *   &startDate=2026-03-01      (옵션, 기본: 최근 7일)
 *   &endDate=2026-03-31
 *   &excludeTest=1             (옵션)
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildEventAnalytics } from '@/src/lib/event-analytics-service'
import { parseEventId, parseLegacySlug, parseDateRange } from '@/src/lib/validate-params'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // eventId 검증 (숫자 1~10자리)
  const eventIdResult = parseEventId(searchParams.get('eventId'))
  if (!eventIdResult.ok) {
    return NextResponse.json({ error: eventIdResult.error }, { status: 400 })
  }

  // legacySlug 검증 (옵션 — 영숫자·하이픈·언더스코어 1~50자)
  const legacySlugResult = parseLegacySlug(searchParams.get('legacySlug'))
  if (!legacySlugResult.ok) {
    return NextResponse.json({ error: legacySlugResult.error }, { status: 400 })
  }

  // 날짜 검증 (형식·순서·최대 366일 클램프) — 무검증 DoS 차단
  const range = parseDateRange(searchParams.get('startDate'), searchParams.get('endDate'))
  if (!range.ok) {
    return NextResponse.json({ error: range.error }, { status: 400 })
  }

  try {
    const data = await buildEventAnalytics({
      eventId: eventIdResult.eventId,
      legacySlug: legacySlugResult.legacySlug ?? undefined,
      trackingCode: searchParams.get('trackingCode') ?? undefined,
      startDate: range.startDate ?? undefined,
      endDate: range.endDate ?? undefined,
      excludeTest: searchParams.get('excludeTest') === '1',
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[event-analytics] build error:', e)
    return NextResponse.json(
      { error: (e as Error).message || 'internal error' },
      { status: 500 },
    )
  }
}
