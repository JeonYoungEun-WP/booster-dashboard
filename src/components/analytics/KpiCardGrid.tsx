'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { SourceBadge, type DataSource } from './KpiGrid'

export interface KpiCardItem {
  label: string
  value: number                    // 현재 값 (원시 숫자)
  prevValue?: number | null        // 전기 값 (없으면 증감률 미표시)
  format: 'number' | 'currency' | 'percent'   // percent → value 가 0~1 비율이면 자동 %, 아니면 그대로
  source: DataSource
  /** 리드/ROAS 등 강조할 카드 */
  highlight?: 'lead' | 'roas'
  /** 전환율 문자열 (예: '세션 → 5.32%') — 있을 때만 보라색 텍스트로 표시 */
  conversion?: string
  /** 단가 문자열 (예: 'CPA ₩33,831') */
  unitPrice?: string
  /** ROAS 처럼 증감률이 percentage points 단위일 때 */
  deltaAsPoints?: boolean
}

interface Props {
  items: KpiCardItem[]
  prevLabel?: string               // '전기' 또는 전 기간 날짜
}

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtKRW(n: number): string {
  return '₩' + fmtNumber(n)
}
function fmtPercent(n: number): string {
  // 비율(0~1) 이면 ×100, 아니면 그대로 취급
  const v = n <= 1 && n >= -1 ? n * 100 : n
  return `${v.toFixed(1)}%`
}
function formatValue(v: number, f: KpiCardItem['format']): string {
  if (f === 'currency') return fmtKRW(v)
  if (f === 'percent') return fmtPercent(v)
  return fmtNumber(v)
}

function computeDelta(cur: number, prev: number | null | undefined, asPoints?: boolean) {
  if (prev == null || !isFinite(prev)) return null
  if (asPoints) {
    // percentage points: cur/prev 이미 비율(0~1) 이라 가정
    const curPct = cur <= 1 && cur >= -1 ? cur * 100 : cur
    const prevPct = prev <= 1 && prev >= -1 ? prev * 100 : prev
    return { kind: 'points' as const, value: curPct - prevPct }
  }
  if (prev === 0) return cur === 0 ? { kind: 'ratio' as const, value: 0 } : null
  return { kind: 'ratio' as const, value: (cur - prev) / prev }
}

function DeltaPill({ delta }: { delta: ReturnType<typeof computeDelta> }) {
  if (!delta) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
        <Minus size={11} /> —
      </span>
    )
  }
  const up = delta.value > 0
  const flat = Math.abs(delta.value) < 1e-9
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
  const cls = flat
    ? 'bg-muted text-muted-foreground'
    : up
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : 'bg-rose-50 text-rose-700 border border-rose-200'
  const sign = flat ? '' : up ? '+' : ''
  const text = delta.kind === 'points'
    ? `${sign}${delta.value.toFixed(1)}p`
    : `${sign}${(delta.value * 100).toFixed(1)}%`
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${cls}`}>
      <Icon size={11} /> {text}
    </span>
  )
}

export function KpiCardGrid({ items, prevLabel = '전기' }: Props) {
  return (
    <section className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {items.map((it) => {
        const delta = computeDelta(it.value, it.prevValue, it.deltaAsPoints)
        const hl = it.highlight
        const cardCls = hl === 'lead'
          ? 'bg-emerald-50/60 border-emerald-200'
          : hl === 'roas'
            ? 'bg-amber-50/60 border-amber-200'
            : 'bg-card border-border'
        return (
          <div key={it.label} className={`rounded-xl border p-5 ${cardCls}`}>
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs text-muted-foreground truncate">{it.label}</span>
                <SourceBadge source={it.source} />
              </div>
              <DeltaPill delta={delta} />
            </div>
            <p className="text-3xl font-bold tabular-nums leading-tight">
              {formatValue(it.value, it.format)}
            </p>
            {it.prevValue != null && (
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                {prevLabel} {formatValue(it.prevValue, it.format)}
              </p>
            )}
            {(it.conversion || it.unitPrice) && (
              <div className="mt-2.5 pt-2.5 border-t border-border/60 space-y-1">
                {it.conversion && (
                  <p className="text-xs text-emerald-600 font-medium tabular-nums">{it.conversion}</p>
                )}
                {it.unitPrice && (
                  <p className="text-xs text-muted-foreground tabular-nums">{it.unitPrice}</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
