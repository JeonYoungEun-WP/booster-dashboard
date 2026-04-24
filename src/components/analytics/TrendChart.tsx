'use client'

import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

export interface TrendPoint {
  date: string         // YYYY-MM-DD
  sessions: number     // (호환성 유지 · 차트엔 미표시)
  leads: number
  reservations: number
}

interface TrendChartProps {
  data: TrendPoint[]
  /** 헤더 오른쪽에 렌더할 커스텀 액션(예: 일/주/월 토글). */
  actions?: React.ReactNode
  /** 타이틀 아래 서브 텍스트 덮어쓰기. */
  subtitle?: string
}

export function TrendChart({ data, actions, subtitle }: TrendChartProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">일자별 추이</h2>
          <p className="text-sm text-muted-foreground">{subtitle ?? '리드·예약 일별 추이'}</p>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div style={{ height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 13 }}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis
              tick={{ fontSize: 13 }}
              label={{ value: '리드·예약', angle: -90, position: 'insideLeft', fontSize: 13, fill: '#f59e0b' }}
            />
            <Tooltip
              contentStyle={{ fontSize: 14, borderRadius: 8, border: '1px solid #e5e8eb' }}
              labelFormatter={(label) => String(label)}
            />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar
              dataKey="leads"
              name="리드"
              fill="#f59e0b"
              fillOpacity={0.75}
              barSize={16}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="reservations"
              name="예약"
              fill="#10b981"
              fillOpacity={0.9}
              barSize={16}
              radius={[3, 3, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
