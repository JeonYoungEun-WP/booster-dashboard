'use client'

import { ArrowRight } from 'lucide-react'

interface Stage {
  label: string
  value: number
  format?: 'number' | 'currency'
  badge?: string
}

interface FunnelFlowProps {
  stages: Stage[]
  trueROAS: number
  adSpend: number
  reservationRevenue: number
}

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtKRW(n: number): string {
  return '₩' + fmtNumber(n)
}

export function FunnelFlow({ stages, trueROAS, adSpend, reservationRevenue }: FunnelFlowProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold">광고비 → 예약 퍼널</h2>
        <span className="text-xs text-muted-foreground">노출부터 최종 예약까지 한 흐름</span>
      </div>

      <div className="flex flex-wrap items-stretch gap-2 mb-5 overflow-x-auto">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-stretch">
            <div className="flex flex-col justify-center min-w-[110px] px-3 py-2 rounded-lg bg-muted/40">
              <span className="text-[11px] text-muted-foreground">{s.label}</span>
              <span className="text-lg font-bold tabular-nums">
                {s.format === 'currency' ? fmtKRW(s.value) : fmtNumber(s.value)}
              </span>
              {s.badge && (
                <span className="text-[10px] text-primary font-medium">{s.badge}</span>
              )}
            </div>
            {i < stages.length - 1 && (
              <div className="flex items-center px-1 text-muted-foreground">
                <ArrowRight size={16} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
        <div>
          <p className="text-[11px] text-muted-foreground">광고비</p>
          <p className="text-xl font-bold">{fmtKRW(adSpend)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">예약 매출 (추정)</p>
          <p className="text-xl font-bold">{fmtKRW(reservationRevenue)}</p>
        </div>
        <div className={`${trueROAS >= 1 ? 'bg-emerald-50' : 'bg-amber-50'} -mx-1 px-3 rounded-lg`}>
          <p className="text-[11px] text-muted-foreground">예약 ROAS (추정)</p>
          <p className={`text-2xl font-bold ${trueROAS >= 1 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {(trueROAS * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </section>
  )
}
