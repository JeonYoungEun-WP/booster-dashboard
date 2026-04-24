'use client'

export type DataSource = 'ga' | 'admin' | 'dummy' | 'clarity'

interface Kpi {
  label: string
  value: string
  sub?: string
  accent?: string
  source?: DataSource
}

interface KpiGridProps {
  items: Kpi[]
}

const SOURCE_STYLE: Record<DataSource, { label: string; className: string }> = {
  ga:      { label: 'GA',     className: 'bg-blue-50 text-blue-700 border-blue-200' },
  admin:   { label: '어드민', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  dummy:   { label: '더미',   className: 'bg-amber-50 text-amber-700 border-amber-200' },
  clarity: { label: 'Clarity',className: 'bg-violet-50 text-violet-700 border-violet-200' },
}

export function SourceBadge({ source }: { source: DataSource }) {
  const s = SOURCE_STYLE[source]
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border leading-none whitespace-nowrap ${s.className}`}>
      {s.label}
    </span>
  )
}

export function KpiGrid({ items }: KpiGridProps) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm text-muted-foreground">{it.label}</p>
            {it.source && <SourceBadge source={it.source} />}
          </div>
          <p className={`text-3xl font-bold ${it.accent || ''}`}>{it.value}</p>
          {it.sub && <p className="text-sm text-muted-foreground mt-1.5">{it.sub}</p>}
        </div>
      ))}
    </section>
  )
}
