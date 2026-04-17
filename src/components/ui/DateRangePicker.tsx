'use client';

interface Props {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

const PRESETS = [
  { label: '최근 7일', days: 6 },
  { label: '최근 14일', days: 13 },
  { label: '최근 30일', days: 29 },
  { label: '최근 90일', days: 89 },
];

function offset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({ startDate, endDate, onChange }: Props) {
  const handlePreset = (days: number) => {
    onChange(offset(days), offset(0));
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 text-sm">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onChange(e.target.value, endDate)}
          className="rounded border border-border px-2 py-1 bg-background"
        />
        <span className="text-muted-foreground">~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onChange(startDate, e.target.value)}
          className="rounded border border-border px-2 py-1 bg-background"
        />
      </div>
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.days)}
            className="text-xs rounded-md border border-border px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
