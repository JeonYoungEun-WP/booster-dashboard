'use client';

import { useEffect, useMemo, useState } from 'react';
import { DateRangePicker } from '@/src/components/ui/DateRangePicker';
import { formatNumber } from '@/src/lib/format';
import {
  CHANNEL_COLOR, CHANNEL_LABEL,
  type AdChannel, type CreativeFormat, type CreativePerformance,
} from '@/src/lib/ad-data';

const ALL_CHANNELS: AdChannel[] = ['google', 'meta', 'naver', 'kakao'];
const ALL_FORMATS: CreativeFormat[] = ['image', 'video', 'carousel', 'text'];

const FORMAT_LABEL: Record<CreativeFormat, string> = {
  image: '이미지',
  video: '비디오',
  carousel: '캐러셀',
  text: '텍스트',
};

const FORMAT_ICON: Record<CreativeFormat, string> = {
  image: '🖼',
  video: '▶',
  carousel: '⊞',
  text: 'Aa',
};

function offset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function fmtKRW(n: number): string {
  return '₩' + Math.round(n).toLocaleString('ko-KR');
}
function fmtPct(n: number): string {
  return n.toFixed(2) + '%';
}

type SortKey = 'cost' | 'impressions' | 'clicks' | 'ctr' | 'conversions' | 'cpa' | 'roas';
type ViewMode = 'card' | 'table';

function StatusBadge({ status }: { status: CreativePerformance['status'] }) {
  const map = {
    ACTIVE: { label: '진행 중', cls: 'bg-emerald-50 text-emerald-700' },
    PAUSED: { label: '일시중지', cls: 'bg-gray-100 text-gray-600' },
    REJECTED: { label: '검수반려', cls: 'bg-rose-50 text-rose-700' },
  };
  const { label, cls } = map[status];
  return <span className={`text-xs rounded-full px-2 py-0.5 ${cls}`}>{label}</span>;
}

function CreativeThumbnail({ c, size = 'md' }: { c: CreativePerformance; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-12 h-12 text-base' : 'w-full aspect-video text-2xl';
  return (
    <div
      className={`${dim} rounded-lg flex items-center justify-center font-bold text-white relative overflow-hidden`}
      style={{
        background: `linear-gradient(135deg, ${c.thumbnailColor} 0%, ${c.thumbnailColor}aa 100%)`,
      }}
    >
      <span className="absolute top-1 left-1.5 text-[10px] opacity-90 bg-black/20 rounded px-1">
        {FORMAT_ICON[c.format]}
      </span>
      {size === 'md' ? (
        <div className="text-center px-3">
          <div className="text-sm font-semibold leading-tight line-clamp-2">{c.headline}</div>
        </div>
      ) : (
        <span className="text-xs">{FORMAT_ICON[c.format]}</span>
      )}
    </div>
  );
}

function CreativeCard({ c }: { c: CreativePerformance }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
      <CreativeThumbnail c={c} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[c.channel] }} />
              {CHANNEL_LABEL[c.channel]} · {FORMAT_LABEL[c.format]}
            </div>
            <p className="font-semibold text-sm truncate">{c.creativeName}</p>
            <p className="text-xs text-muted-foreground truncate">{c.campaignName}</p>
          </div>
          <StatusBadge status={c.status} />
        </div>

        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">"{c.description}"</p>

        <div className="grid grid-cols-3 gap-2 text-xs border-t border-border/50 pt-3">
          <div>
            <p className="text-muted-foreground">노출</p>
            <p className="font-semibold">{formatNumber(c.impressions)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">CTR</p>
            <p className="font-semibold">{fmtPct(c.ctr)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">전환(리드수)</p>
            <p className="font-semibold">{formatNumber(c.conversions)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">비용</p>
            <p className="font-semibold">{fmtKRW(c.cost)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">CPA</p>
            <p className="font-semibold">{fmtKRW(c.cpa)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">ROAS</p>
            <p className={`font-semibold ${c.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(c.roas)}</p>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground mt-2">등록일 {c.createdAt}</p>
      </div>
    </div>
  );
}

export default function CreativesPage() {
  const [startDate, setStartDate] = useState(offset(29));
  const [endDate, setEndDate] = useState(offset(0));
  const [channels, setChannels] = useState<AdChannel[]>(ALL_CHANNELS);
  const [formats, setFormats] = useState<CreativeFormat[]>(ALL_FORMATS);
  const [creatives, setCreatives] = useState<CreativePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  useEffect(() => {
    setLoading(true);
    const chQuery = channels.length === ALL_CHANNELS.length ? '' : `&channels=${channels.join(',')}`;
    fetch(`/api/ad-performance?view=creatives&startDate=${startDate}&endDate=${endDate}${chQuery}`)
      .then((r) => r.json())
      .then((d) => { setCreatives(d.creatives || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [startDate, endDate, channels]);

  const filtered = useMemo(() => {
    return creatives.filter((c) => formats.includes(c.format));
  }, [creatives, formats]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [filtered, sortKey, sortDir]);

  // 포맷별 합계
  const formatSummary = useMemo(() => {
    const sum: Record<CreativeFormat, { count: number; impressions: number; clicks: number; cost: number; conversions: number }> = {
      image: { count: 0, impressions: 0, clicks: 0, cost: 0, conversions: 0 },
      video: { count: 0, impressions: 0, clicks: 0, cost: 0, conversions: 0 },
      carousel: { count: 0, impressions: 0, clicks: 0, cost: 0, conversions: 0 },
      text: { count: 0, impressions: 0, clicks: 0, cost: 0, conversions: 0 },
    };
    creatives.forEach((c) => {
      sum[c.format].count++;
      sum[c.format].impressions += c.impressions;
      sum[c.format].clicks += c.clicks;
      sum[c.format].cost += c.cost;
      sum[c.format].conversions += c.conversions;
    });
    return sum;
  }, [creatives]);

  const toggleChannel = (ch: AdChannel) => {
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  };
  const toggleFormat = (f: CreativeFormat) => {
    setFormats((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(k); setSortDir('desc'); }
  };
  const sortIcon = (k: SortKey) => sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  // TOP 3 / WORST 3 인사이트
  const top3 = useMemo(() => [...filtered].sort((a, b) => b.roas - a.roas).slice(0, 3), [filtered]);
  const worst3 = useMemo(() => [...filtered].filter((c) => c.cost > 0).sort((a, b) => a.roas - b.roas).slice(0, 3), [filtered]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">소재별 성과</h1>
          <p className="text-sm text-muted-foreground mt-1">크리에이티브 단위로 어떤 소재가 잘 팔리는지 분석합니다</p>
        </div>


        {/* 필터 바 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />

            <div className="flex gap-1">
              {ALL_CHANNELS.map((ch) => {
                const on = channels.includes(ch);
                return (
                  <button
                    key={ch}
                    onClick={() => toggleChannel(ch)}
                    className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                      on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: CHANNEL_COLOR[ch] }} />
                    {CHANNEL_LABEL[ch]}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1">
              {ALL_FORMATS.map((f) => {
                const on = formats.includes(f);
                return (
                  <button
                    key={f}
                    onClick={() => toggleFormat(f)}
                    className={`text-xs rounded-md px-2.5 py-1 border transition-colors ${
                      on ? 'border-foreground bg-foreground/5' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {FORMAT_ICON[f]} {FORMAT_LABEL[f]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={`${sortKey}-${sortDir}`}
              onChange={(e) => {
                const [k, d] = e.target.value.split('-');
                setSortKey(k as SortKey);
                setSortDir(d as 'asc' | 'desc');
              }}
              className="text-sm rounded-md border border-border bg-background px-2 py-1.5"
            >
              <option value="cost-desc">비용 ↓</option>
              <option value="impressions-desc">노출 ↓</option>
              <option value="clicks-desc">클릭 ↓</option>
              <option value="ctr-desc">CTR ↓</option>
              <option value="conversions-desc">전환(리드수) ↓</option>
              <option value="roas-desc">ROAS ↓</option>
              <option value="cpa-asc">CPA ↑(낮은순)</option>
            </select>
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setViewMode('card')}
                className={`text-sm px-3 py-1.5 ${viewMode === 'card' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
              >
                카드
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`text-sm px-3 py-1.5 ${viewMode === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
              >
                테이블
              </button>
            </div>
          </div>
        </div>

        {/* 포맷별 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {ALL_FORMATS.map((f) => {
            const s = formatSummary[f];
            const ctr = s.impressions ? (s.clicks / s.impressions) * 100 : 0;
            const cpa = s.conversions ? s.cost / s.conversions : 0;
            return (
              <div key={f} className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground mb-1">{FORMAT_ICON[f]} {FORMAT_LABEL[f]} ({s.count}개)</p>
                <p className="text-lg font-bold">{fmtKRW(s.cost)}</p>
                <p className="text-xs text-muted-foreground mt-1">CTR {ctr.toFixed(2)}% · CPA {fmtKRW(cpa)}</p>
              </div>
            );
          })}
        </div>

        {/* 인사이트 (TOP/WORST) */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-sm font-semibold text-emerald-700 mb-2">🏆 ROAS TOP 3 소재</p>
              <div className="space-y-1.5">
                {top3.map((c) => (
                  <div key={c.creativeId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHANNEL_COLOR[c.channel] }} />
                      <span className="truncate">{c.creativeName}</span>
                    </div>
                    <span className="font-semibold text-emerald-700 ml-2">{fmtPct(c.roas)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
              <p className="text-sm font-semibold text-rose-700 mb-2">⚠ 효율 낮은 소재 (ROAS 하위)</p>
              <div className="space-y-1.5">
                {worst3.map((c) => (
                  <div key={c.creativeId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHANNEL_COLOR[c.channel] }} />
                      <span className="truncate">{c.creativeName}</span>
                    </div>
                    <span className="font-semibold text-rose-700 ml-2">{fmtPct(c.roas)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 본문 */}
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">로딩 중...</div>
        ) : sorted.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">조건에 맞는 소재가 없습니다</div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map((c) => <CreativeCard key={c.creativeId} c={c} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 px-3">소재</th>
                  <th className="py-2 px-3">포맷</th>
                  <th className="py-2 px-3">채널</th>
                  <th className="py-2 px-3">상태</th>
                  <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('impressions')}>노출{sortIcon('impressions')}</th>
                  <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('clicks')}>클릭{sortIcon('clicks')}</th>
                  <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('ctr')}>CTR{sortIcon('ctr')}</th>
                  <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('cost')}>비용{sortIcon('cost')}</th>
                  <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('conversions')}>전환(리드수){sortIcon('conversions')}</th>
                  <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('cpa')}>CPA{sortIcon('cpa')}</th>
                  <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('roas')}>ROAS{sortIcon('roas')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr key={c.creativeId} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        <CreativeThumbnail c={c} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.creativeName}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.headline}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs">{FORMAT_ICON[c.format]} {FORMAT_LABEL[c.format]}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[c.channel] }} />
                        {CHANNEL_LABEL[c.channel]}
                      </span>
                    </td>
                    <td className="py-2 px-3"><StatusBadge status={c.status} /></td>
                    <td className="py-2 px-3 text-right">{formatNumber(c.impressions)}</td>
                    <td className="py-2 px-3 text-right">{formatNumber(c.clicks)}</td>
                    <td className="py-2 px-3 text-right">{fmtPct(c.ctr)}</td>
                    <td className="py-2 px-3 text-right">{fmtKRW(c.cost)}</td>
                    <td className="py-2 px-3 text-right">{formatNumber(c.conversions)}</td>
                    <td className="py-2 px-3 text-right">{fmtKRW(c.cpa)}</td>
                    <td className={`py-2 px-3 text-right font-semibold ${c.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(c.roas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
