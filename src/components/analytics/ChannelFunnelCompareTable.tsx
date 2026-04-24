'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Eye, MousePointerClick, UserPlus, CalendarCheck, FileSignature, Activity,
} from 'lucide-react'
import { ChannelIcon } from '@/src/components/ui/ChannelIcon'
import { CHANNEL_LABEL, type AdChannel } from '@/src/lib/ad-data'
import type { FunnelStageRow } from './FunnelMetricsTable'

export interface ChannelFunnelGroup {
  channel: AdChannel
  /** 라벨 시퀀스는 모든 그룹이 동일해야 함 (노출·클릭·리드·예약·계약 등) */
  rows: FunnelStageRow[]
  adSpend: number
  revenue: number
  roas: number
}

interface Props {
  groups: ChannelFunnelGroup[]
  title?: string
  subtitle?: string
}

const ICONS: Record<string, LucideIcon> = {
  '노출': Eye,
  '클릭': MousePointerClick,
  '리드': UserPlus,
  '예약': CalendarCheck,
  '방문예약': CalendarCheck,
  '계약': FileSignature,
  '결제': FileSignature,
}

const GROUPED_LABELS = new Set(['리드', '예약', '방문예약', '계약', '결제'])

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtKRWFull(n: number): string {
  return '₩' + Math.round(n).toLocaleString('ko-KR')
}
/** 컴팩트 포맷 — 넓이 절약용 */
function fmtKRWCompact(n: number): string {
  if (n >= 1_000_000) return `₩${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `₩${Math.round(n / 1000).toLocaleString('ko-KR')}K`
  return '₩' + Math.round(n).toLocaleString('ko-KR')
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

export function ChannelFunnelCompareTable({
  groups,
  title = '채널별 퍼널',
  subtitle = '단계별 수 · 전환율 · 전환 단가',
}: Props) {
  if (groups.length === 0) return null

  // 모든 채널 공통 라벨 시퀀스 — 첫 채널 기준
  const labels = groups[0].rows.map((r) => r.label)

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr>
              <th rowSpan={2} className="py-2 pr-3 font-medium text-left text-muted-foreground text-sm align-bottom w-[140px]">
                단계
              </th>
              {groups.map((g) => (
                <th
                  key={g.channel}
                  colSpan={2}
                  className="py-2 px-2 text-center border-l border-border/60 border-b border-border"
                >
                  <div className="inline-flex items-center gap-1.5 text-sm font-semibold">
                    <ChannelIcon channel={g.channel} size={16} />
                    {CHANNEL_LABEL[g.channel]}
                  </div>
                </th>
              ))}
            </tr>
            <tr className="border-b border-border text-muted-foreground text-xs">
              {groups.map((g) => (
                <React.Fragment key={g.channel}>
                  <th className="py-1.5 px-2 font-medium text-right border-l border-border/60">수</th>
                  <th className="py-1.5 pl-2 pr-2 font-medium text-right">전환 / 단가</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => {
              const Icon = ICONS[label] ?? Activity
              const grouped = GROUPED_LABELS.has(label)
              // 단계 메타 (source 뱃지) — 첫 채널 기준
              const stageMeta = groups[0].rows[i]
              return (
                <tr
                  key={label}
                  className={`border-b border-border/50 ${grouped ? 'bg-primary/[0.03]' : ''}`}
                >
                  <td className="py-3 pr-3">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Icon size={16} strokeWidth={1.8} />
                      </div>
                      <div>
                        <div className="text-base font-medium">{label}</div>
                        <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                          stageMeta.source === 'admin'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : stageMeta.source === 'ga'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {stageMeta.source === 'admin' ? '어드민' : stageMeta.source === 'ga' ? 'GA' : '더미'}
                        </span>
                      </div>
                    </div>
                  </td>
                  {groups.map((g) => {
                    const row = g.rows[i]
                    return (
                      <React.Fragment key={g.channel}>
                        <td className="py-3 px-2 text-right tabular-nums border-l border-border/60">
                          <span className="text-base font-semibold">{fmtNumber(row.value)}</span>
                        </td>
                        <td className="py-3 pl-2 pr-2 text-right tabular-nums">
                          {row.conversionRate !== undefined ? (
                            <div>
                              <div className="text-sm font-medium">{fmtPct(row.conversionRate)}</div>
                              {row.costPerAction !== undefined && row.costPerAction > 0 ? (
                                <div className="text-xs text-muted-foreground">{fmtKRWCompact(row.costPerAction)}</div>
                              ) : (
                                <div className="text-xs text-muted-foreground">—</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>
                      </React.Fragment>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <th className="py-2.5 pr-3 text-left text-sm font-medium text-muted-foreground">광고비</th>
              {groups.map((g) => (
                <td
                  key={g.channel}
                  colSpan={2}
                  className="py-2.5 px-2 text-right tabular-nums text-base font-semibold border-l border-border/60"
                >
                  {fmtKRWFull(g.adSpend)}
                </td>
              ))}
            </tr>
            <tr>
              <th className="py-2.5 pr-3 text-left text-sm font-medium text-muted-foreground">매출</th>
              {groups.map((g) => (
                <td
                  key={g.channel}
                  colSpan={2}
                  className="py-2.5 px-2 text-right tabular-nums text-base font-semibold border-l border-border/60"
                >
                  {fmtKRWFull(g.revenue)}
                </td>
              ))}
            </tr>
            <tr>
              <th className="py-2.5 pr-3 text-left text-sm font-medium text-muted-foreground">ROAS</th>
              {groups.map((g) => (
                <td
                  key={g.channel}
                  colSpan={2}
                  className={`py-2.5 px-2 text-right tabular-nums text-base font-semibold border-l border-border/60 ${
                    g.roas >= 1 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {fmtPct(g.roas)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
