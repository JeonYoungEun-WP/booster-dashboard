'use client'

import { useMemo } from 'react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import { CHANNEL_LABEL, type AdChannel } from '@/src/lib/ad-data'

export interface ChannelRadarRow {
  channel: string               // 'meta' | 'tiktok' | ...
  cvrLead: number               // 0~1
  cvrReservation: number        // 0~1
  cvrContract: number           // 0~1
  roas: number                  // 0~N (1 = 본전)
}

interface Props {
  rows: ChannelRadarRow[]
  height?: number
}

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

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`
}
function fmtRoas(v: number): string {
  return `${(v * 100).toFixed(0)}%`
}

const METRICS: Array<{
  key: keyof Omit<ChannelRadarRow, 'channel'>
  label: string
  fmt: (v: number) => string
}> = [
  { key: 'cvrLead',        label: '리드 전환',    fmt: fmtPct },
  { key: 'cvrReservation', label: '예약 전환',    fmt: fmtPct },
  { key: 'cvrContract',    label: '계약 전환',    fmt: fmtPct },
  { key: 'roas',           label: 'ROAS',         fmt: fmtRoas },
]

interface TooltipEntry {
  name?: string | number
  dataKey?: string | number
  payload?: Record<string, number | string>
  value?: number | string
}

export function ChannelRadar({ rows, height = 300 }: Props) {
  const strokeOnly = rows.length >= 5

  // 지표별 최대값 (정규화 분모)
  const maxByMetric = useMemo(() => {
    const m: Record<string, number> = {}
    for (const metric of METRICS) {
      const values = rows.map((r) => Number(r[metric.key] ?? 0))
      m[metric.key] = Math.max(0.0001, ...values)
    }
    return m
  }, [rows])

  // recharts 용 데이터 구조 — 각 metric 한 행, 채널별 컬럼
  const chartData = useMemo(() => {
    return METRICS.map((metric) => {
      const row: Record<string, number | string> = { metric: metric.label }
      for (const r of rows) {
        const raw = Number(r[metric.key] ?? 0)
        row[r.channel] = (raw / maxByMetric[metric.key]) * 100          // 0~100 정규화
        row[`${r.channel}__raw`] = raw                                   // tooltip 원본값
      }
      return row
    })
  }, [rows, maxByMetric])

  if (rows.length === 0) return null

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <h3 className="text-sm font-semibold">채널 프로파일</h3>
        <span className="text-xs text-muted-foreground">각 지표별 최고값 대비 상대 비중</span>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} outerRadius="78%">
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fontSize: 12, fill: '#454f5d' }}
            />
            <Tooltip
              contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e8eb' }}
              formatter={(_v, name, item) => {
                const entry = item as TooltipEntry
                const channel = typeof entry.dataKey === 'string' ? entry.dataKey : ''
                const metricLabel = typeof entry.payload?.metric === 'string' ? entry.payload.metric : ''
                const metric = METRICS.find((m) => m.label === metricLabel)
                const raw = Number(entry.payload?.[`${channel}__raw`] ?? 0)
                return [metric?.fmt(raw) ?? String(raw), name]
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
            {rows.map((r, i) => {
              const color = colorFor(r.channel, i)
              return (
                <Radar
                  key={r.channel}
                  name={CHANNEL_LABEL[r.channel as AdChannel] ?? r.channel}
                  dataKey={r.channel}
                  stroke={color}
                  fill={strokeOnly ? 'transparent' : color}
                  fillOpacity={strokeOnly ? 0 : 0.18}
                  strokeWidth={2}
                />
              )
            })}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
