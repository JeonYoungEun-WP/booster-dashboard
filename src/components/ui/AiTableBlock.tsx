'use client'

/**
 * AI 챗이 tableData 도구로 내려주는 구조화 표 렌더러.
 * route.ts 의 tableSchema 와 1:1 매칭.
 */

export type TableFormat = 'text' | 'number' | 'currency' | 'percent' | 'roas' | 'code'

export interface TableColumn {
  key: string
  header: string
  format?: TableFormat
  align?: 'left' | 'right' | 'center'
}

export interface TableBlockData {
  title: string
  subtitle?: string
  columns: TableColumn[]
  rows: Array<Record<string, string | number | null>>
  footer?: Record<string, string | number | null>
  highlightRule?: 'top-roas' | 'bottom-roas' | 'none'
}

function isNumericFormat(f?: TableFormat): boolean {
  return f === 'number' || f === 'currency' || f === 'percent' || f === 'roas'
}

function defaultAlign(f?: TableFormat): 'left' | 'right' | 'center' {
  if (isNumericFormat(f)) return 'right'
  if (f === 'code') return 'left'
  return 'left'
}

function formatValue(v: string | number | null | undefined, format?: TableFormat): string {
  if (v === null || v === undefined || v === '') return '—'
  switch (format) {
    case 'number': {
      const n = typeof v === 'number' ? v : Number(v)
      return isNaN(n) ? String(v) : Math.round(n).toLocaleString('ko-KR')
    }
    case 'currency': {
      const n = typeof v === 'number' ? v : Number(v)
      return isNaN(n) ? String(v) : '₩' + Math.round(n).toLocaleString('ko-KR')
    }
    case 'percent': {
      const n = typeof v === 'number' ? v : Number(v)
      if (isNaN(n)) return String(v)
      // AI 가 이미 × 100 된 값을 보낼 수도, 비율 (0.05) 로 보낼 수도 있음 — 1 초과면 이미 %로 간주
      const pct = Math.abs(n) > 1 ? n : n * 100
      return pct.toFixed(2) + '%'
    }
    case 'roas': {
      const n = typeof v === 'number' ? v : Number(v)
      if (isNaN(n)) return String(v)
      const pct = Math.abs(n) > 1 ? n : n * 100
      return pct.toFixed(2) + '%'
    }
    case 'code':
      return String(v)
    case 'text':
    default:
      return String(v)
  }
}

/** ROAS 컬러 — 1(=100%) 이상 녹색, 미만 주황 */
function roasColor(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const n = typeof v === 'number' ? v : Number(v)
  if (isNaN(n)) return ''
  const pct = Math.abs(n) > 1 ? n / 100 : n
  return pct >= 1 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'
}

export function AiTableBlock({ data }: { data: TableBlockData }) {
  // 하이라이트 대상 행 index 계산 (highlightRule)
  const roasCol = data.columns.find((c) => c.format === 'roas')
  let hlTopIdx = -1
  let hlBottomIdx = -1
  if (roasCol && (data.highlightRule === 'top-roas' || data.highlightRule === 'bottom-roas')) {
    const vals = data.rows.map((r, i) => {
      const raw = r[roasCol.key]
      const n = typeof raw === 'number' ? raw : Number(raw)
      return { i, n: isNaN(n) ? -Infinity : n }
    })
    if (data.highlightRule === 'top-roas') {
      hlTopIdx = vals.reduce((best, cur) => (cur.n > best.n ? cur : best), vals[0]).i
    } else {
      hlBottomIdx = vals.reduce((worst, cur) => (cur.n < worst.n ? cur : worst), vals[0]).i
    }
  }

  return (
    <div className="my-3 rounded-lg border border-border bg-background overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="text-sm font-semibold text-foreground">{data.title}</div>
        {data.subtitle && (
          <div className="text-xs text-muted-foreground mt-0.5">{data.subtitle}</div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              {data.columns.map((c) => {
                const align = c.align ?? defaultAlign(c.format)
                return (
                  <th
                    key={c.key}
                    className={`px-3 py-2 font-semibold text-xs text-muted-foreground whitespace-nowrap ${
                      align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {c.header}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => {
              const rowHl =
                ri === hlTopIdx ? 'bg-emerald-50/50' :
                ri === hlBottomIdx ? 'bg-amber-50/50' : ri % 2 === 0 ? '' : 'bg-muted/10'
              return (
                <tr key={ri} className={`border-b border-border/50 last:border-b-0 ${rowHl}`}>
                  {data.columns.map((c) => {
                    const align = c.align ?? defaultAlign(c.format)
                    const value = row[c.key]
                    const text = formatValue(value, c.format)
                    const extraClass =
                      c.format === 'roas' ? roasColor(value) :
                      c.format === 'code' ? 'font-mono text-xs' :
                      isNumericFormat(c.format) ? 'tabular-nums' : ''
                    return (
                      <td
                        key={c.key}
                        className={`px-3 py-2 ${
                          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                        } ${extraClass}`}
                      >
                        {text}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          {data.footer && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                {data.columns.map((c, ci) => {
                  const align = c.align ?? defaultAlign(c.format)
                  const value = data.footer?.[c.key]
                  const text = ci === 0 && (value === undefined || value === null || value === '')
                    ? '합계'
                    : formatValue(value, c.format)
                  const extraClass = c.format === 'roas' ? roasColor(value) :
                    isNumericFormat(c.format) ? 'tabular-nums' : ''
                  return (
                    <td
                      key={c.key}
                      className={`px-3 py-2 ${
                        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                      } ${extraClass}`}
                    >
                      {text}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
