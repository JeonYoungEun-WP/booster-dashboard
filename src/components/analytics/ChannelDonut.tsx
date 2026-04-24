'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { CHANNEL_LABEL, type AdChannel } from '@/src/lib/ad-data'

export interface ChannelDonutRow {
  channel: string                 // 'meta' | 'tiktok' | ...
  leads: number
  adSpend: number
  sessions: number
  /** 세션→리드 전환율 (0~1) */
  cvr: number
}

interface Props {
  rows: ChannelDonutRow[]
}

// 채널 고유 색
const CHANNEL_COLOR: Record<string, string> = {
  meta: '#1877F2',
  tiktok: '#000000',
  google: '#4285F4',
  naver: '#03C75A',
  kakao: '#FEE500',
  karrot: '#FF7E1D',
}
const FALLBACK_COLORS = ['#6c5ce7', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#8b5cf6']

function colorFor(channel: string, i: number): string {
  return CHANNEL_COLOR[channel] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]
}

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtKRW(n: number): string {
  if (n >= 1_000_000) return `₩${(n / 1_000_000).toFixed(1)}M`
  return '₩' + fmtNumber(n)
}
function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`
}

interface MetricBarProps {
  title: string
  subtitle: string
  rows: Array<{ channel: string; name: string; value: number; color: string }>
  formatter: (v: number) => string
  max: number
}

function MetricBars({ title, subtitle, rows, formatter, max }: MetricBarProps) {
  if (rows.length === 0) return null
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <ul className="space-y-1">
        {rows.map((r) => {
          const pct = max > 0 ? Math.max(2, (r.value / max) * 100) : 0
          return (
            <li key={r.channel} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs font-medium truncate">{r.name}</span>
              <div className="flex-1 h-3.5 bg-muted/50 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: `${pct}%`, background: r.color }}
                />
              </div>
              <span className="w-20 text-right text-xs tabular-nums font-semibold">
                {formatter(r.value)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function ChannelDonut({ rows }: Props) {
  // 채널 순서 = 리드 내림차순 (전체 섹션에서 일관 적용)
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.leads - a.leads),
    [rows],
  )

  // 도넛: 리드 기준 비중
  const donutData = useMemo(() => {
    return sortedRows.map((r, i) => ({
      name: CHANNEL_LABEL[r.channel as AdChannel] ?? r.channel,
      channel: r.channel,
      value: r.leads,
      color: colorFor(r.channel, i),
    }))
  }, [sortedRows])

  const total = useMemo(() => donutData.reduce((s, d) => s + d.value, 0), [donutData])

  const legend = useMemo(() => {
    return donutData.map((d) => ({
      ...d,
      share: total > 0 ? d.value / total : 0,
    }))
  }, [donutData, total])

  // 광고비 막대 — 채널 순서 유지 (리드 내림차순)
  const adSpendBars = useMemo(() => {
    return sortedRows.map((r, i) => ({
      channel: r.channel,
      name: CHANNEL_LABEL[r.channel as AdChannel] ?? r.channel,
      value: r.adSpend,
      color: colorFor(r.channel, i),
    }))
  }, [sortedRows])
  const maxAdSpend = useMemo(() => Math.max(0, ...adSpendBars.map((r) => r.value)), [adSpendBars])

  // 전환율 막대 — 채널 순서 유지 (리드 내림차순)
  const cvrBars = useMemo(() => {
    return sortedRows.map((r, i) => ({
      channel: r.channel,
      name: CHANNEL_LABEL[r.channel as AdChannel] ?? r.channel,
      value: r.cvr,
      color: colorFor(r.channel, i),
    }))
  }, [sortedRows])
  const maxCvr = useMemo(() => Math.max(0, ...cvrBars.map((r) => r.value)), [cvrBars])

  return (
    <section className="rounded-xl border border-border bg-card p-4 h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold">채널 비중</h2>
        <span className="text-sm text-muted-foreground">리드 기준</span>
      </div>

      {/* 도넛 + 범례 — 나란히 배치 (세로 높이 절약) */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                innerRadius={42}
                outerRadius={66}
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive
                animationDuration={400}
              >
                {donutData.map((d) => (
                  <Cell key={d.channel} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e8eb' }}
                formatter={(v) => fmtNumber(typeof v === 'number' ? v : 0)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-muted-foreground leading-none">총 리드</span>
            <span className="text-base font-bold tabular-nums leading-tight mt-0.5">{fmtNumber(total)}</span>
          </div>
        </div>

        {/* 범례 — 도넛 오른쪽, 채널 순 */}
        <ul className="flex-1 min-w-0 space-y-1.5">
          {legend.map((d) => (
            <li key={d.channel} className="flex items-center gap-1.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="font-medium truncate">{d.name}</span>
              <span className="ml-auto tabular-nums text-xs text-muted-foreground">{(d.share * 100).toFixed(1)}%</span>
            </li>
          ))}
          {legend.length === 0 && (
            <li className="text-sm text-muted-foreground py-2 text-center">
              채널 데이터가 없습니다
            </li>
          )}
        </ul>
      </div>

      {/* 광고비·전환율 막대그래프 — 아래 2단 */}
      <div className="space-y-4 pt-4 border-t border-border flex-1">
        <MetricBars
          title="광고비"
          subtitle="채널별 지출"
          rows={adSpendBars}
          formatter={fmtKRW}
          max={maxAdSpend}
        />
        <MetricBars
          title="전환율"
          subtitle="세션 대비 리드 CVR"
          rows={cvrBars}
          formatter={fmtPct}
          max={maxCvr}
        />
      </div>
    </section>
  )
}
