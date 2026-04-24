'use client'

export type TrendGranularity = 'day' | 'week' | 'month'

const BUTTONS: Array<{ key: TrendGranularity; label: string }> = [
  { key: 'day',   label: '일별' },
  { key: 'week',  label: '주별' },
  { key: 'month', label: '월별' },
]

interface Props {
  value: TrendGranularity
  onChange: (v: TrendGranularity) => void
}

export function TrendGranularityToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
      {BUTTONS.map((b) => (
        <button
          key={b.key}
          type="button"
          onClick={() => onChange(b.key)}
          className={`text-sm px-3.5 py-1.5 rounded-md transition-colors ${
            value === b.key
              ? 'bg-violet-600 text-white font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}

/** 날짜 문자열의 해당 주 월요일 반환 (YYYY-MM-DD). */
function weekStartMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dow = d.getUTCDay()                  // 일=0, 월=1, ...
  const diff = dow === 0 ? 6 : dow - 1        // 월요일로 back-shift
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

export interface AggregatablePoint {
  date: string
  sessions: number
  leads: number
  reservations: number
}

/** 일별 포인트를 granularity 에 맞춰 집계. */
export function aggregateTrend<T extends AggregatablePoint>(
  data: T[],
  granularity: TrendGranularity,
): T[] {
  if (granularity === 'day') return data
  const bucket = new Map<string, AggregatablePoint>()
  for (const row of data) {
    const key = granularity === 'week' ? weekStartMonday(row.date) : row.date.slice(0, 7)
    const prev = bucket.get(key) ?? { date: key, sessions: 0, leads: 0, reservations: 0 }
    bucket.set(key, {
      date: key,
      sessions: prev.sessions + row.sessions,
      leads: prev.leads + row.leads,
      reservations: prev.reservations + row.reservations,
    })
  }
  return Array.from(bucket.values()).sort((a, b) => a.date.localeCompare(b.date)) as T[]
}
