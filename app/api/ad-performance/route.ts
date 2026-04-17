import { NextRequest, NextResponse } from 'next/server'
import {
  getChannelSummary,
  getDailyTrend,
  getDailyByChannel,
  getCampaignPerformance,
  getCreativePerformance,
  getTotalSummary,
  getIntegrationStatus,
  type AdChannel,
} from '@/src/lib/ad-data'

export const maxDuration = 30

function todayMinusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') || 'dashboard'
  const startDate = searchParams.get('startDate') || todayMinusDays(29)
  const endDate = searchParams.get('endDate') || todayMinusDays(0)
  const channelsParam = searchParams.get('channels')
  const channels = channelsParam
    ? (channelsParam.split(',').filter(Boolean) as AdChannel[])
    : undefined

  const opts = { startDate, endDate, channels }

  try {
    if (view === 'dashboard') {
      const [total, byChannel, daily, dailyByChannel, campaigns, integrations] = await Promise.all([
        getTotalSummary(opts),
        getChannelSummary(opts),
        getDailyTrend(opts),
        getDailyByChannel(opts),
        getCampaignPerformance(opts),
        Promise.resolve(getIntegrationStatus()),
      ])
      return NextResponse.json({
        period: { startDate, endDate },
        total,
        byChannel,
        daily,
        dailyByChannel,
        topCampaigns: campaigns.slice(0, 10),
        integrations,
      })
    }
    if (view === 'channels') {
      const byChannel = await getChannelSummary(opts)
      return NextResponse.json({ period: { startDate, endDate }, byChannel })
    }
    if (view === 'daily') {
      const daily = await getDailyTrend(opts)
      return NextResponse.json({ period: { startDate, endDate }, daily })
    }
    if (view === 'campaigns') {
      const campaigns = await getCampaignPerformance(opts)
      return NextResponse.json({ period: { startDate, endDate }, campaigns })
    }
    if (view === 'creatives') {
      const creatives = await getCreativePerformance(opts)
      return NextResponse.json({ period: { startDate, endDate }, creatives })
    }
    if (view === 'integrations') {
      return NextResponse.json({ integrations: getIntegrationStatus() })
    }
    return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
