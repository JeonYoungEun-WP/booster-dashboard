'use client'

interface Kpi {
  label: string
  value: string
  sub?: string
  accent?: string
}

interface KpiGridProps {
  items: Kpi[]
}

export function KpiGrid({ items }: KpiGridProps) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">{it.label}</p>
          <p className={`text-2xl font-bold ${it.accent || ''}`}>{it.value}</p>
          {it.sub && <p className="text-xs text-muted-foreground mt-1">{it.sub}</p>}
        </div>
      ))}
    </section>
  )
}
