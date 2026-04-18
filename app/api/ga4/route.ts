import { NextRequest, NextResponse } from 'next/server'
import {
  getTotals, getDaily, getByChannel, getBySource, healthCheck, hasGA4Creds,
} from '@/src/lib/channels/ga4'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

function todayMinusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') || 'summary'
  const startDate = searchParams.get('startDate') || todayMinusDays(29)
  const endDate = searchParams.get('endDate') || todayMinusDays(0)

  if (!hasGA4Creds()) {
    return NextResponse.json({
      error: 'GA4 credentials not configured',
      hint: 'Set GA4_PROPERTY_ID + (GCP_SA_KEY_JSON or Workload Identity env vars) in Vercel.',
      propertyIdSet: !!process.env.GA4_PROPERTY_ID,
    }, { status: 503 })
  }

  try {
    if (view === 'summary') {
      const [totals, daily, byChannel, bySource] = await Promise.all([
        getTotals(startDate, endDate),
        getDaily(startDate, endDate),
        getByChannel(startDate, endDate),
        getBySource(startDate, endDate),
      ])
      return NextResponse.json({
        period: { startDate, endDate },
        propertyId: process.env.GA4_PROPERTY_ID,
        totals, daily, byChannel, bySource,
      })
    }
    if (view === 'totals') {
      return NextResponse.json({ period: { startDate, endDate }, totals: await getTotals(startDate, endDate) })
    }
    if (view === 'daily') {
      return NextResponse.json({ period: { startDate, endDate }, daily: await getDaily(startDate, endDate) })
    }
    if (view === 'channels') {
      return NextResponse.json({ period: { startDate, endDate }, byChannel: await getByChannel(startDate, endDate) })
    }
    if (view === 'sources') {
      return NextResponse.json({ period: { startDate, endDate }, bySource: await getBySource(startDate, endDate) })
    }
    if (view === 'health') {
      return NextResponse.json(await healthCheck())
    }
    return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
