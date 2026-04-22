'use client'

import { ArrowDown, TrendingUp, TrendingDown } from 'lucide-react'
import { SourceBadge, type DataSource } from './KpiGrid'

export interface FunnelStage {
  label: string
  value: number
  source?: DataSource
}

interface FunnelFlowProps {
  stages: FunnelStage[]       // 위→아래 순서: 노출·클릭·세션·리드·방문예약·결제
  trueROAS: number            // 0.0 ~ N (배수)
  adSpend: number
  reservationRevenue: number
  finalStageLabel?: string    // 퍼널 마지막 단계 이름 (기본 '결제')
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

/** 단계별 바 너비 — log 스케일 (소수점 차이 많아도 너무 얇아지지 않게) */
function widthPct(value: number, topValue: number): number {
  if (value <= 0 || topValue <= 0) return 28
  const ratio = Math.log10(value + 1) / Math.log10(topValue + 1)
  // 최소 28%, 최대 100%
  return Math.max(28, Math.min(100, ratio * 100))
}

/** 단계별 배경/테두리 색 — 위(인지)에서 아래(매출)로 그라데이션 */
const STAGE_COLORS = [
  { bar: 'bg-violet-50 border-violet-300',   text: 'text-violet-900',   accent: 'text-violet-700' },
  { bar: 'bg-blue-50 border-blue-300',       text: 'text-blue-900',     accent: 'text-blue-700' },
  { bar: 'bg-cyan-50 border-cyan-300',       text: 'text-cyan-900',     accent: 'text-cyan-700' },
  { bar: 'bg-amber-50 border-amber-300',     text: 'text-amber-900',    accent: 'text-amber-700' },
  { bar: 'bg-orange-50 border-orange-300',   text: 'text-orange-900',   accent: 'text-orange-700' },
  { bar: 'bg-emerald-50 border-emerald-400', text: 'text-emerald-900',  accent: 'text-emerald-700' },
]

function getStageStyle(i: number, total: number) {
  // 항상 마지막은 emerald (결제·성공)
  if (i === total - 1) return STAGE_COLORS[STAGE_COLORS.length - 1]
  return STAGE_COLORS[Math.min(i, STAGE_COLORS.length - 2)]
}

export function FunnelFlow({
  stages, trueROAS, adSpend, reservationRevenue, finalStageLabel = '결제',
}: FunnelFlowProps) {
  const topValue = stages[0]?.value ?? 1

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold">광고비 → {finalStageLabel} 퍼널</h2>
        <span className="text-xs text-muted-foreground">단계별 전환율 한눈에</span>
      </div>

      {/* 최상단: 광고비 입력 카드 */}
      <div className="flex items-center justify-center mb-3">
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2 flex items-center gap-3">
          <div>
            <p className="text-[11px] text-slate-500">광고비 (투입)</p>
            <p className="text-lg font-bold text-slate-900">{fmtKRW(adSpend)}</p>
          </div>
          <SourceBadge source="admin" />
        </div>
      </div>

      <div className="flex justify-center mb-2">
        <ArrowDown size={14} className="text-muted-foreground" />
      </div>

      {/* 퍼널 바 — log 스케일 너비 */}
      <div className="space-y-1.5">
        {stages.map((stage, i) => {
          const style = getStageStyle(i, stages.length)
          const width = widthPct(stage.value, topValue)
          const prev = stages[i - 1]
          const dropoff = prev && prev.value > 0 ? stage.value / prev.value : null
          const isDropoffGood = dropoff !== null && dropoff >= 0.5

          return (
            <div key={stage.label}>
              {/* 전 단계 → 이 단계의 드롭오프 */}
              {dropoff !== null && (
                <div className="flex justify-center mb-1">
                  <div className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    isDropoffGood ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {isDropoffGood ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {fmtPct(dropoff)}
                  </div>
                </div>
              )}
              <div
                className={`mx-auto rounded-lg border-2 px-4 py-2.5 flex items-center justify-between transition-all ${style.bar}`}
                style={{ width: `${width}%` }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-xs font-medium ${style.text}`}>{stage.label}</span>
                  {stage.source && <SourceBadge source={stage.source} />}
                </div>
                <span className={`text-xl font-bold tabular-nums ${style.text}`}>
                  {fmtNumber(stage.value)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center my-2">
        <ArrowDown size={14} className="text-muted-foreground" />
      </div>

      {/* 하단: 매출 결과 + ROAS */}
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
            <p className="text-[11px] text-muted-foreground" title="결제 매출 ÷ 광고비">ROAS</p>
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
