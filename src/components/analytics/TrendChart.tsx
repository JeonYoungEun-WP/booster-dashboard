'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

export interface TrendPoint {
  date: string         // YYYY-MM-DD
  sessions: number
  leads: number
  reservations: number
}

interface TrendChartProps {
  data: TrendPoint[]
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">일자별 추이</h2>
        <span className="text-xs text-muted-foreground">세션(선) · 리드·예약(막대)</span>
      </div>
      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              label={{ value: '세션', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#8b5cf6' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              label={{ value: '리드·예약', angle: 90, position: 'insideRight', fontSize: 11, fill: '#f59e0b' }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e8eb' }}
              labelFormatter={(label) => String(label)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {/* 리드·예약: 우측 Y축 · 막대 (예약을 뒤에 그려 위로 쌓이도록) */}
            <Bar
              yAxisId="right"
              dataKey="leads"
              name="리드"
              fill="#f59e0b"
              fillOpacity={0.75}
              barSize={14}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="reservations"
              name="예약"
              fill="#10b981"
              fillOpacity={0.9}
              barSize={14}
              radius={[2, 2, 0, 0]}
            />
            {/* 세션: 좌측 Y축 · 선 (기존 형태, 가장 앞에 그려지도록 마지막) */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="sessions"
              name="세션"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
