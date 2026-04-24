import { NextResponse } from 'next/server'
import { buildScopeAnalytics } from '@/src/lib/scope-analytics-service'
import type { ScopeType } from '@/src/lib/scope-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') as ScopeType | null
  const id = searchParams.get('id')
  const startDate = searchParams.get('startDate') ?? undefined
  const endDate = searchParams.get('endDate') ?? undefined
  const excludeTest = searchParams.get('excludeTest') === '1'

  if (!scope || !id || !['brand', 'project', 'event'].includes(scope)) {
    return NextResponse.json(
      { error: 'scope (brand|project|event) 와 id 파라미터 필수' },
      { status: 400 },
    )
  }

  try {
    const data = await buildScopeAnalytics({ scope, id, startDate, endDate, excludeTest })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[scope-analytics] error:', e)
    return NextResponse.json(
      { error: (e as Error).message ?? String(e) },
      { status: 500 },
    )
  }
}
