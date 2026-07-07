import { NextRequest, NextResponse } from 'next/server'
import {
  getChannelSummary,
  getDailyTrend,
  getDailyByChannel,
  getCampaignPerformance,
  getCreativePerformance,
  getTotalSummary,
  getIntegrationStatus,
  getAnalyticsIntegrationStatus,
  type AdChannel,
} from '@/src/lib/ad-data'
import { todayKST, offsetDateKST } from '@/src/lib/date-kst'
import { parseDateRange } from '@/src/lib/validate-params'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') || 'dashboard'

  // 날짜 검증 (형식·순서·최대 366일 클램프) — 무검증 DoS 차단
  const range = parseDateRange(searchParams.get('startDate'), searchParams.get('endDate'))
  if (!range.ok) {
    return NextResponse.json({ error: range.error }, { status: 400 })
  }
  // 미지정 시 KST 기준 최근 30일 (UTC 하루 밀림 방지)
  const startDate = range.startDate ?? offsetDateKST(29)
  const endDate = range.endDate ?? todayKST()

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
      return NextResponse.json({
        integrations: getIntegrationStatus(),
        analytics: getAnalyticsIntegrationStatus(),
      })
    }
    return NextResponse.json({ error: 'Unknown view' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
