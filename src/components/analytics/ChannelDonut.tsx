'use client'

import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { CHANNEL_LABEL, type AdChannel } from '@/src/lib/ad-data'
import { ChannelIcon } from '@/src/components/ui/ChannelIcon'

type MetricKey = 'leads' | 'adSpend' | 'sessions' | 'cvr'

export interface ChannelDonutRow {
  channel: string                 // 'meta' | 'tiktok' | ...
  leads: number
  adSpend: number
  sessions: number                // 채널별 세션 (ga4 bySource 에서 매핑)
  /** 세션→리드 전환율 (0~1) */
  cvr: number
}

interface Props {
  rows: ChannelDonutRow[]
}

const TABS: Array<{ key: MetricKey; label: string }> = [
  { key: 'leads',   label: '리드' },
  { key: 'adSpend', label: '광고비' },
  { key: 'sessions',label: '세션' },
  { key: 'cvr',     label: '전환율' },
]

// 채널 고유 색 (Meta/TikTok/Naver/Google/Kakao/Karrot 공통 palette)
const CHANNEL_COLOR: Record<string, string> = {
  meta: '#1877F2',
  tiktok: '#000000',
  google: '#4285F4',
  naver: '#03C75A',
  kakao: '#FEE500',
  karrot: '#FF7E1D',
}
const FALLBACK_COLORS = ['#6c5ce7', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#8b5cf6']

function formatValue(v: number, metric: MetricKey): string {
  if (metric === 'adSpend') {
    if (v >= 1_000_000) return `₩${(v / 1_000_000).toFixed(1)}M`
    if (v >= 10_000) return `₩${(v / 10_000).toFixed(0)}만`
    return '₩' + Math.round(v).toLocaleString('ko-KR')
  }
  if (metric === 'cvr') return `${(v * 100).toFixed(2)}%`
  return Math.round(v).toLocaleString('ko-KR')
}

export function ChannelDonut({ rows }: Props) {
  const [tab, setTab] = useState<MetricKey>('leads')

  const chartData = useMemo(() => {
    return rows.map((r, i) => ({
      name: CHANNEL_LABEL[r.channel as AdChannel] ?? r.channel,
      channel: r.channel,
      value: r[tab],
      color: CHANNEL_COLOR[r.channel] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    }))
  }, [rows, tab])

  const total = useMemo(() => chartData.reduce((s, d) => s + d.value, 0), [chartData])

  const legend = useMemo(() => {
    return chartData.map((d) => ({
      ...d,
      share: total > 0 ? d.value / total : 0,
    }))
  }, [chartData, total])

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">채널 비중</h2>
        <span className="text-[11px] text-muted-foreground">
          {tab === 'cvr' ? '세션 → 리드 CVR' : '전체 대비 채널 기여도'}
        </span>
      </div>

      {/* 탭 */}
      <div className="inline-flex rounded-lg bg-muted p-0.5 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              tab === t.key
                ? 'bg-white text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        {/* 도넛 */}
        <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive
                animationDuration={400}
              >
                {chartData.map((d) => (
                  <Cell key={d.channel} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e8eb' }}
                formatter={(v) => formatValue(typeof v === 'number' ? v : 0, tab)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-muted-foreground">
              {tab === 'cvr' ? '채널 평균' : 'Total'}
            </span>
            <span className="text-lg font-bold tabular-nums">
              {tab === 'cvr'
                ? formatValue(legend.length > 0 ? total / legend.length : 0, 'cvr')
                : formatValue(total, tab)}
            </span>
          </div>
        </div>

        {/* 범례 */}
        <ul className="flex-1 min-w-0 space-y-2">
          {legend.map((d) => (
            <li key={d.channel} className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <ChannelIcon channel={d.channel as AdChannel} size={14} />
              <span className="font-medium truncate">{d.name}</span>
              <span className="ml-auto tabular-nums text-muted-foreground text-xs">
                {tab !== 'cvr' && <span className="mr-2">{(d.share * 100).toFixed(1)}%</span>}
                <span className="text-foreground">{formatValue(d.value, tab)}</span>
              </span>
            </li>
          ))}
          {legend.length === 0 && (
            <li className="text-xs text-muted-foreground py-4 text-center">
              채널 데이터가 없습니다
            </li>
          )}
        </ul>
      </div>
    </section>
  )
}
