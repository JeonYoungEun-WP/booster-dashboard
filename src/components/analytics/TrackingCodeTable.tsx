'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface TrackingCodeRow {
  trackingCode: string
  adSpend: number
  impressions: number
  clicks: number
  leads: number
  reservations: number
  cpa_lead: number               // 리드 획득당 비용
  costPerReservation: number     // 예약 1건당 광고비
  reservationROAS: number        // 예약 매출 ÷ 광고비
}

interface TrackingCodeTableProps {
  rows: TrackingCodeRow[]
  /** 기본 펼침 여부 — 미지정 시 접혀 있음 */
  defaultOpen?: boolean
}

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtKRW(n: number): string {
  return '₩' + fmtNumber(n)
}
function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%'
}

export function TrackingCodeTable({ rows, defaultOpen = false }: TrackingCodeTableProps) {
  const [open, setOpen] = useState(defaultOpen)

  // 합계 계산
  const totals = useMemo(() => {
    const adSpend = rows.reduce((s, r) => s + r.adSpend, 0)
    const impressions = rows.reduce((s, r) => s + r.impressions, 0)
    const clicks = rows.reduce((s, r) => s + r.clicks, 0)
    const leads = rows.reduce((s, r) => s + r.leads, 0)
    const reservations = rows.reduce((s, r) => s + r.reservations, 0)
    // 합계 수준 단가·ROAS 재계산 (평균 아닌 총합 기준)
    const cpa_lead = leads > 0 ? adSpend / leads : 0
    const costPerReservation = reservations > 0 ? adSpend / reservations : 0
    // reservationROAS 는 객단가 미상이라 합계 차원에선 각 row 의 매출 합으로 대체
    // — 현재 row 에 매출 미포함이므로 개별 ROAS 가중평균 (광고비 기준)
    const totalRoasNumerator = rows.reduce((s, r) => s + (r.reservationROAS * r.adSpend), 0)
    const reservationROAS = adSpend > 0 ? totalRoasNumerator / adSpend : 0
    return { adSpend, impressions, clicks, leads, reservations, cpa_lead, costPerReservation, reservationROAS }
  }, [rows])

  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/30 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown size={20} className="shrink-0" /> : <ChevronRight size={20} className="shrink-0" />}
          <h2 className="text-base font-semibold">트래킹코드별 성과 (광고세트 단위)</h2>
        </div>
        <span className="text-sm text-muted-foreground shrink-0">
          {rows.length}개 코드 · 광고비 {fmtKRW(totals.adSpend)} · 리드 {fmtNumber(totals.leads)} · 예약 {fmtNumber(totals.reservations)}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b-2 border-border text-left text-muted-foreground text-sm">
                <th className="py-3 pr-3 font-medium">트래킹코드</th>
                <th className="py-3 px-3 font-medium text-right">광고비</th>
                <th className="py-3 px-3 font-medium text-right">노출</th>
                <th className="py-3 px-3 font-medium text-right">클릭</th>
                <th className="py-3 px-3 font-medium text-right">리드</th>
                <th className="py-3 px-3 font-medium text-right">예약</th>
                <th className="py-3 px-3 font-medium text-right" title="리드 획득당 비용">CPA</th>
                <th className="py-3 px-3 font-medium text-right">예약 획득 비용</th>
                <th className="py-3 pl-3 font-medium text-right" title="예약 매출 ÷ 광고비">예약 매출 배수</th>
              </tr>
            </thead>
            <tbody>
              {/* 합계 행 — 최상단 · 강조 */}
              {rows.length > 0 && (
                <tr className="border-b-2 border-border bg-muted/30 font-semibold">
                  <td className="py-3 pr-3">합계</td>
                  <td className="py-3 px-3 text-right tabular-nums">{fmtKRW(totals.adSpend)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{fmtNumber(totals.impressions)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{fmtNumber(totals.clicks)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{fmtNumber(totals.leads)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{fmtNumber(totals.reservations)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{totals.cpa_lead > 0 ? fmtKRW(totals.cpa_lead) : '—'}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{totals.costPerReservation > 0 ? fmtKRW(totals.costPerReservation) : '—'}</td>
                  <td className={`py-3 pl-3 text-right tabular-nums ${
                    totals.reservationROAS >= 1 ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {totals.adSpend > 0 ? fmtPct(totals.reservationROAS) : '—'}
                  </td>
                </tr>
              )}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    매핑된 트래킹코드 데이터가 없습니다
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.trackingCode} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 pr-3 font-mono text-sm">{r.trackingCode}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{fmtKRW(r.adSpend)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{fmtNumber(r.impressions)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{fmtNumber(r.clicks)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{fmtNumber(r.leads)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{fmtNumber(r.reservations)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{r.cpa_lead > 0 ? fmtKRW(r.cpa_lead) : '—'}</td>
                  <td className="py-3 px-3 text-right tabular-nums">{r.costPerReservation > 0 ? fmtKRW(r.costPerReservation) : '—'}</td>
                  <td className={`py-3 pl-3 text-right tabular-nums font-semibold ${
                    r.reservationROAS >= 1 ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {r.adSpend > 0 ? fmtPct(r.reservationROAS) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
