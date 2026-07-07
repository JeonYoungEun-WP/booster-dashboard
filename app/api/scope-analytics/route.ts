import { NextResponse } from 'next/server'
import { buildScopeAnalytics } from '@/src/lib/scope-analytics-service'
import type { ScopeType } from '@/src/lib/scope-catalog'
import { legacySlugSchema, parseDateRange } from '@/src/lib/validate-params'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') as ScopeType | null
  const id = searchParams.get('id')
  const excludeTest = searchParams.get('excludeTest') === '1'

  // scope 는 allowlist 로 검증 (기존 로직 유지)
  if (!scope || !id || !['brand', 'project', 'event'].includes(scope)) {
    return NextResponse.json(
      { error: 'scope (brand|project|event) 와 id 파라미터 필수' },
      { status: 400 },
    )
  }

  // id 검증 (브랜드/프로젝트/이벤트 식별자 — 영숫자·하이픈·언더스코어 1~50자)
  const idResult = legacySlugSchema.safeParse(id)
  if (!idResult.success) {
    return NextResponse.json({ error: 'id 형식이 올바르지 않습니다' }, { status: 400 })
  }

  // 날짜 검증 (형식·순서·최대 366일 클램프) — 무검증 DoS 차단
  const range = parseDateRange(searchParams.get('startDate'), searchParams.get('endDate'))
  if (!range.ok) {
    return NextResponse.json({ error: range.error }, { status: 400 })
  }
  const startDate = range.startDate ?? undefined
  const endDate = range.endDate ?? undefined

  try {
    const data = await buildScopeAnalytics({ scope, id: idResult.data, startDate, endDate, excludeTest })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[scope-analytics] error:', e)
    return NextResponse.json(
      { error: (e as Error).message ?? String(e) },
      { status: 500 },
    )
  }
}
