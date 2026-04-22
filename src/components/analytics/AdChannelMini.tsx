'use client'

import { ChannelIcon } from '@/src/components/ui/ChannelIcon'
import { CHANNEL_LABEL, type AdChannel, type CampaignPerformance } from '@/src/lib/ad-data'

interface AdChannelMiniProps {
  eventCampaigns: CampaignPerformance[]
}

interface ChannelAgg {
  channel: AdChannel
  campaignCount: number
  adSpend: number
  clicks: number
  conversions: number
}

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtKRW(n: number): string {
  return '₩' + fmtNumber(n)
}

export function AdChannelMini({ eventCampaigns }: AdChannelMiniProps) {
  // 이벤트 매핑된 캠페인들을 채널 단위로 합산
  const map = new Map<AdChannel, ChannelAgg>()
  for (const c of eventCampaigns) {
    const prev = map.get(c.channel) ?? {
      channel: c.channel, campaignCount: 0, adSpend: 0, clicks: 0, conversions: 0,
    }
    map.set(c.channel, {
      ...prev,
      campaignCount: prev.campaignCount + 1,
      adSpend: prev.adSpend + c.cost,
      clicks: prev.clicks + c.clicks,
      conversions: prev.conversions + c.conversions,
    })
  }
  const rows = Array.from(map.values()).sort((a, b) => b.adSpend - a.adSpend)

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">채널별 광고 성과 (이 이벤트)</h2>
        <span className="text-xs text-muted-foreground">
          {eventCampaigns.length}개 캠페인 · {rows.length}개 채널
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          매핑된 광고 캠페인이 없습니다 — 캠페인명에 <code className="text-xs bg-muted px-1 rounded">#{'{eventId}_{trackingCode}'}</code> 형식으로 태그를 추가해주세요
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {rows.map((r) => (
            <div key={r.channel} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <ChannelIcon channel={r.channel} size={20} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{CHANNEL_LABEL[r.channel]}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.campaignCount}개 캠페인 · 클릭 {fmtNumber(r.clicks)}
                </p>
              </div>
              <div className="text-right tabular-nums">
                <p className="text-sm font-semibold">{fmtKRW(r.adSpend)}</p>
                <p className="text-[11px] text-muted-foreground">전환 {fmtNumber(r.conversions)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
