'use client'

import { SourceBadge, type DataSource } from './KpiGrid'

export interface FunnelStage {
  label: string
  value: number
  source?: DataSource
  cpu?: number       // 획득당 비용 (광고비 ÷ value)
  cpuLabel?: string  // 예: "CPA" / "결제당 광고비"
}

interface FunnelFlowProps {
  stages: FunnelStage[]       // 위→아래 순서: 노출·클릭·세션·리드·방문예약·결제
  trueROAS: number
  adSpend: number
  reservationRevenue: number
  finalStageLabel?: string
}

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtKRW(n: number): string {
  return '₩' + fmtNumber(n)
}
function fmtPct(ratio: number): string {
  return (ratio * 100).toFixed(2) + '%'
}

export function FunnelFlow({
  stages, trueROAS, adSpend, reservationRevenue, finalStageLabel = '결제',
}: FunnelFlowProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold">광고비 → {finalStageLabel} 퍼널</h2>
        <span className="text-xs text-muted-foreground">단계별 전환율 표기</span>
      </div>

      {/* 퍼널 단계 카드 — 가로 스크롤 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
        {stages.map((stage, i) => {
          const prev = stages[i - 1]
          const conv = prev && prev.value > 0 ? stage.value / prev.value : null
          const convGood = conv !== null && conv >= 0.5

          return (
            <div
              key={stage.label}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="text-xs text-muted-foreground">{stage.label}</span>
                {stage.source && <SourceBadge source={stage.source} />}
              </div>
              <p className="text-2xl font-bold tabular-nums">{fmtNumber(stage.value)}</p>
              {conv !== null ? (
                <p className={`text-[11px] mt-1 ${
                  convGood ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  <span className="text-muted-foreground">{prev.label} →</span> {fmtPct(conv)}
                </p>
              ) : (
                <p className="text-[11px] mt-1 text-muted-foreground">시작</p>
              )}
              {stage.cpu !== undefined && stage.cpu > 0 && (
                <div className="mt-2 pt-2 border-t border-border/60">
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {stage.cpuLabel ?? '획득당 비용'}
                  </p>
                  <p className="text-sm font-semibold tabular-nums leading-tight">
                    {fmtKRW(stage.cpu)}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 하단: 광고비 · 매출 · ROAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <p className="text-[11px] text-slate-500">광고비</p>
            <SourceBadge source="admin" />
          </div>
          <p className="text-xl font-bold text-slate-900">{fmtKRW(adSpend)}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <p className="text-[11px] text-emerald-700">매출 (추정)</p>
            <SourceBadge source="dummy" />
          </div>
          <p className="text-xl font-bold text-emerald-800">{fmtKRW(reservationRevenue)}</p>
        </div>
        <div className={`rounded-lg border p-3 ${
          trueROAS >= 1
            ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300'
            : 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300'
        }`}>
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <p className="text-[11px] text-muted-foreground" title="매출 ÷ 광고비">ROAS</p>
            <SourceBadge source="dummy" />
          </div>
          <p className={`text-2xl font-bold ${trueROAS >= 1 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {(trueROAS * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </section>
  )
}
