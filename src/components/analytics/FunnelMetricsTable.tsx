'use client'

import type { LucideIcon } from 'lucide-react'
import { Eye, MousePointerClick, Activity, UserPlus, CalendarCheck, FileSignature } from 'lucide-react'
import { ChannelIcon } from '@/src/components/ui/ChannelIcon'
import { CHANNEL_LABEL, type AdChannel } from '@/src/lib/ad-data'

export interface FunnelStageRow {
  label: string                    // '노출' | '클릭' | '세션' | '리드' | '예약' | '계약'
  value: number
  source: 'admin' | 'ga' | 'dummy'
  /** 이전 단계 대비 전환율 (0~1). 없으면 표시 안함 (노출 등 시작 단계). */
  conversionRate?: number
  /** 전환율 계산 기준 라벨 (예: '노출', '클릭', '세션', '리드', '예약'). */
  prevLabel?: string
  /** 획득당 단가 (원). 없으면 '—' 표시. */
  costPerAction?: number
  /** 단가 라벨 (예: 'CPC', 'CPA', '예약당 단가', '계약당 단가'). */
  costLabel?: string
}

interface Props {
  rows: FunnelStageRow[]
  adSpend: number
  revenue: number
  roas: number
  /** 카드 상단 타이틀. 기본 '퍼널 성과 요약'. */
  title?: string
  /** 타이틀 옆 서브 텍스트. */
  subtitle?: string
  /** 채널 아이콘 (예: 'meta' / 'tiktok') — 지정 시 타이틀 왼쪽에 표시. */
  channel?: AdChannel
}

const ICONS: Record<string, LucideIcon> = {
  '노출': Eye,
  '클릭': MousePointerClick,
  '세션': Activity,
  '리드': UserPlus,
  '예약': CalendarCheck,
  '방문예약': CalendarCheck,
  '계약': FileSignature,
  '결제': FileSignature,
}

const SOURCE_BADGE: Record<FunnelStageRow['source'], { label: string; cls: string }> = {
  admin: { label: '어드민', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ga: { label: 'GA',     cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  dummy: { label: '더미',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
}

// 전환·획득 지표인 "입력 그룹" (하이라이트 배경) — 리드/예약/계약 행
const GROUPED_LABELS = new Set(['리드', '예약', '방문예약', '계약', '결제'])

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtKRW(n: number): string {
  return '₩' + fmtNumber(n)
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

export function FunnelMetricsTable({
  rows, adSpend, revenue, roas,
  title = '퍼널 성과 요약',
  subtitle = '단계별 수 · 전환율 · 전환 단가',
  channel,
}: Props) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {channel && <ChannelIcon channel={channel} size={22} />}
          <h2 className="text-base font-semibold truncate">
            {title}
            {channel && <span className="ml-1.5 text-muted-foreground font-normal">· {CHANNEL_LABEL[channel]}</span>}
          </h2>
        </div>
        <span className="text-sm text-muted-foreground shrink-0">{subtitle}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground text-sm">
              <th className="py-3 pr-3 font-medium">단계</th>
              <th className="py-3 px-3 font-medium text-right">수</th>
              <th className="py-3 px-3 font-medium text-right">전환율</th>
              <th className="py-3 pl-3 font-medium text-right">전환 단가</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const Icon = ICONS[r.label] ?? Activity
              const sb = SOURCE_BADGE[r.source]
              const grouped = GROUPED_LABELS.has(r.label)
              return (
                <tr
                  key={`${r.label}-${i}`}
                  className={`border-b border-border/50 ${grouped ? 'bg-primary/[0.03]' : ''}`}
                >
                  <td className="py-3.5 pr-3">
                    <div className="inline-flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Icon size={18} strokeWidth={1.8} />
                      </div>
                      <div>
                        <div className="text-base font-medium">{r.label}</div>
                        <span className={`inline-block mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded border ${sb.cls}`}>
                          {sb.label}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums">
                    <span className="text-xl font-semibold">{fmtNumber(r.value)}</span>
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums">
                    {r.conversionRate !== undefined ? (
                      <div>
                        <div className="text-base font-medium text-foreground">{fmtPct(r.conversionRate)}</div>
                        {r.prevLabel && (
                          <div className="text-xs text-muted-foreground">{r.prevLabel} → {r.label}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3.5 pl-3 text-right tabular-nums">
                    {r.costPerAction !== undefined && r.costPerAction > 0 ? (
                      <div>
                        <div className="text-base font-medium text-foreground">{fmtKRW(r.costPerAction)}</div>
                        {r.costLabel && (
                          <div className="text-xs text-muted-foreground">{r.costLabel}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-6 mt-5 pt-4 border-t border-border">
        <div>
          <div className="text-sm text-muted-foreground">광고비</div>
          <div className="text-lg font-semibold tabular-nums mt-0.5">{fmtKRW(adSpend)}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">매출</div>
          <div className="text-lg font-semibold tabular-nums mt-0.5">{fmtKRW(revenue)}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-sm text-muted-foreground">ROAS</div>
          <div className={`text-lg font-semibold tabular-nums mt-0.5 ${roas >= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {fmtPct(roas)}
          </div>
        </div>
      </div>
    </section>
  )
}
