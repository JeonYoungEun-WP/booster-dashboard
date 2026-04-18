'use client';

interface Props {
  startDate: string;
  endDate: string;
  compare?: boolean;
  excludeToday?: boolean;
  onChange: (start: string, end: string) => void;
  onCompareChange?: (v: boolean) => void;
  onExcludeTodayChange?: (v: boolean) => void;
}

function today(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(offsetWeeks = 0): string {
  const d = new Date();
  const dow = d.getDay(); // 0=일
  d.setDate(d.getDate() - dow + offsetWeeks * 7);
  return d.toISOString().slice(0, 10);
}

function endOfWeek(offsetWeeks = 0): string {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (6 - dow) + offsetWeeks * 7);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths, 1);
  return d.toISOString().slice(0, 10);
}

function endOfMonth(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths + 1, 0);
  return d.toISOString().slice(0, 10);
}

interface Preset { label: string; start: () => string; end: () => string }

const PRESETS: Preset[] = [
  { label: '오늘', start: () => today(0), end: () => today(0) },
  { label: '어제', start: () => today(1), end: () => today(1) },
  { label: '이번 주', start: () => startOfWeek(), end: () => today(0) },
  { label: '지난 주', start: () => startOfWeek(-1), end: () => endOfWeek(-1) },
  { label: '이번 달', start: () => startOfMonth(), end: () => today(0) },
  { label: '지난 달', start: () => startOfMonth(-1), end: () => endOfMonth(-1) },
  { label: '최근 7일', start: () => today(6), end: () => today(0) },
  { label: '최근 30일', start: () => today(29), end: () => today(0) },
  { label: '최근 90일', start: () => today(89), end: () => today(0) },
];

export function DateRangePicker({
  startDate, endDate,
  compare, excludeToday,
  onChange, onCompareChange, onExcludeTodayChange,
}: Props) {
  const handlePreset = (p: Preset) => onChange(p.start(), p.end());
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 text-sm">
        <input type="date" value={startDate} onChange={(e) => onChange(e.target.value, endDate)}
               className="rounded border border-border px-2 py-1 bg-background" />
        <span className="text-muted-foreground">~</span>
        <input type="date" value={endDate} onChange={(e) => onChange(startDate, e.target.value)}
               className="rounded border border-border px-2 py-1 bg-background" />
      </div>
      <div className="flex gap-1 flex-wrap">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => handlePreset(p)}
                  className="text-xs rounded-md border border-border px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground bg-white">
            {p.label}
          </button>
        ))}
      </div>
      {(onCompareChange || onExcludeTodayChange) && (
        <div className="flex items-center gap-3 ml-1 pl-3 border-l border-border text-xs">
          {onCompareChange && (
            <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
              <input type="checkbox" checked={!!compare} onChange={(e) => onCompareChange(e.target.checked)} className="rounded" />
              전기 대비
            </label>
          )}
          {onExcludeTodayChange && (
            <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
              <input type="checkbox" checked={!!excludeToday} onChange={(e) => onExcludeTodayChange(e.target.checked)} className="rounded" />
              오늘 제외
            </label>
          )}
        </div>
      )}
    </div>
  );
}
