'use client'

interface SourceRow {
  source: string
  medium: string
  campaign: string
  sessions: number
  conversions: number
}

interface SourceTableProps {
  rows: SourceRow[]
  unavailableReason?: string
}

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

export function SourceTable({ rows, unavailableReason }: SourceTableProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-base font-semibold">GA4 소스 · 매체 · 캠페인</h2>
        <span className="text-sm text-muted-foreground">이 이벤트 랜딩 페이지 전환 기여도</span>
      </div>
      {unavailableReason && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
          GA4 연결이 준비되지 않았습니다 — {unavailableReason}
        </div>
      )}
      {!unavailableReason && (
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground text-sm">
                <th className="py-3 pr-3 font-medium">Source</th>
                <th className="py-3 px-3 font-medium">Medium</th>
                <th className="py-3 px-3 font-medium">Campaign</th>
                <th className="py-3 pl-3 font-medium text-right">Conversions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    데이터가 없습니다
                  </td>
                </tr>
              )}
              {rows.slice(0, 25).map((r, i) => (
                <tr key={`${r.source}-${r.medium}-${r.campaign}-${i}`} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 pr-3">{r.source}</td>
                  <td className="py-3 px-3 text-muted-foreground">{r.medium}</td>
                  <td className="py-3 px-3 text-sm truncate max-w-[320px]" title={r.campaign}>{r.campaign}</td>
                  <td className="py-3 pl-3 text-right tabular-nums">{fmtNumber(r.conversions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
