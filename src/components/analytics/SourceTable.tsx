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
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold">GA4 소스 · 매체 · 캠페인</h2>
        <span className="text-xs text-muted-foreground">이 이벤트 랜딩 페이지로 유입된 세션</span>
      </div>
      {unavailableReason && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
          GA4 연결이 준비되지 않았습니다 — {unavailableReason}
        </div>
      )}
      {!unavailableReason && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 px-3 font-medium">Medium</th>
                <th className="py-2 px-3 font-medium">Campaign</th>
                <th className="py-2 px-3 font-medium text-right">Sessions</th>
                <th className="py-2 pl-3 font-medium text-right">Conversions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    데이터가 없습니다
                  </td>
                </tr>
              )}
              {rows.slice(0, 25).map((r, i) => (
                <tr key={`${r.source}-${r.medium}-${r.campaign}-${i}`} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 pr-3">{r.source}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.medium}</td>
                  <td className="py-2 px-3 text-xs truncate max-w-[320px]" title={r.campaign}>{r.campaign}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{fmtNumber(r.sessions)}</td>
                  <td className="py-2 pl-3 text-right tabular-nums">{fmtNumber(r.conversions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
