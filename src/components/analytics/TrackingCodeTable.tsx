'use client'

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

export function TrackingCodeTable({ rows }: TrackingCodeTableProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">트래킹코드별 성과 (광고세트 단위)</h2>
        <span className="text-xs text-muted-foreground">광고비 · 리드 · 예약 · CPA · 예약 매출 배수</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">트래킹코드</th>
              <th className="py-2 px-3 font-medium text-right">광고비</th>
              <th className="py-2 px-3 font-medium text-right">노출</th>
              <th className="py-2 px-3 font-medium text-right">클릭</th>
              <th className="py-2 px-3 font-medium text-right">리드</th>
              <th className="py-2 px-3 font-medium text-right">예약</th>
              <th className="py-2 px-3 font-medium text-right" title="리드 획득당 비용">CPA</th>
              <th className="py-2 px-3 font-medium text-right">예약 획득 비용</th>
              <th className="py-2 pl-3 font-medium text-right" title="예약 매출 ÷ 광고비">예약 매출 배수</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-muted-foreground">
                  매핑된 트래킹코드 데이터가 없습니다
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.trackingCode} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2 pr-3 font-mono text-xs">{r.trackingCode}</td>
                <td className="py-2 px-3 text-right tabular-nums">{fmtKRW(r.adSpend)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{fmtNumber(r.impressions)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{fmtNumber(r.clicks)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{fmtNumber(r.leads)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{fmtNumber(r.reservations)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{r.cpa_lead > 0 ? fmtKRW(r.cpa_lead) : '—'}</td>
                <td className="py-2 px-3 text-right tabular-nums">{r.costPerReservation > 0 ? fmtKRW(r.costPerReservation) : '—'}</td>
                <td className={`py-2 pl-3 text-right tabular-nums font-semibold ${
                  r.reservationROAS >= 1 ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {r.adSpend > 0 ? fmtPct(r.reservationROAS) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
