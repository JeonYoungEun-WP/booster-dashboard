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

export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }

  try {
    const data = await buildEventAnalytics({
      eventId,
      legacySlug: searchParams.get('legacySlug') ?? undefined,
      trackingCode: searchParams.get('trackingCode') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
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
