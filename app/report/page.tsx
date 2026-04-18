'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { DateRangePicker } from '@/src/components/ui/DateRangePicker';
import { formatNumber } from '@/src/lib/format';
import {
  CHANNEL_COLOR, CHANNEL_LABEL,
  type AdMetrics, type ChannelPerformance, type DailyPerformance,
  type CampaignPerformance, type CreativePerformance,
} from '@/src/lib/ad-data';

type PageId = 'cover' | 'kpi' | 'trend' | 'creatives';

const PAGES: { id: PageId; label: string }[] = [
  { id: 'cover', label: '표지' },
  { id: 'kpi', label: '핵심 지표' },
  { id: 'trend', label: '추이' },
  { id: 'creatives', label: '광고 소재' },
];

interface DashboardData {
  period: { startDate: string; endDate: string };
  total: AdMetrics;
  byChannel: ChannelPerformance[];
  daily: DailyPerformance[];
  dailyByChannel: { date: string; google: number; meta: number; naver: number; kakao: number }[];
  topCampaigns: CampaignPerformance[];
}

function offset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function fmtKRW(n: number): string { return '₩' + Math.round(n).toLocaleString('ko-KR'); }
function fmtKRWShort(n: number): string {
  if (n >= 100000000) return `₩${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `₩${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `₩${(n / 1000).toFixed(1)}천`;
  return '₩' + Math.round(n).toLocaleString('ko-KR');
}
function fmtPct(n: number): string { return n.toFixed(2) + '%'; }
function fmtNumShort(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return formatNumber(n);
}
function fmtDate(s: string): string {
  const d = new Date(s);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ─────────── 페이지 프레임 ───────────

function PageFrame({ children, pageNum, total }: { children: React.ReactNode; pageNum: number; total: number }) {
  return (
    <div className="report-page bg-white rounded-lg border border-border shadow-sm overflow-hidden mx-auto relative"
         style={{ width: '100%', maxWidth: '1080px', minHeight: '760px' }}>
      <div className="p-8 h-full flex flex-col">
        {children}
        <div className="mt-auto pt-4 text-[10px] text-muted-foreground text-center">
          {pageNum} / {total}
        </div>
      </div>
    </div>
  );
}

// ─────────── 표지 ───────────

function CoverPage({ title, subtitle, startDate, endDate, onTitleChange, onSubtitleChange }: {
  title: string; subtitle: string; startDate: string; endDate: string;
  onTitleChange: (v: string) => void; onSubtitleChange: (v: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 rounded-lg bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 flex items-center justify-center relative overflow-hidden mb-8">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 30%, white 0%, transparent 40%), radial-gradient(circle at 80% 70%, white 0%, transparent 40%)',
        }} />
        <div className="text-center text-white relative z-10 px-8">
          <p className="text-sm uppercase tracking-[0.2em] opacity-80 mb-3">Ad Performance Report</p>
          <p className="text-2xl font-light opacity-90">{fmtDate(startDate)} — {fmtDate(endDate)}</p>
        </div>
      </div>
      <div className="space-y-3 px-2">
        <div className="border-l-4 border-violet-500 pl-4">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="제목 입력"
            className="text-3xl font-bold w-full bg-transparent border-none outline-none focus:ring-0 placeholder:text-gray-300"
          />
        </div>
        <textarea
          value={subtitle}
          onChange={(e) => onSubtitleChange(e.target.value)}
          placeholder="부제목 입력 (예: 월간 광고 성과 요약, 주요 인사이트 등)"
          rows={3}
          className="w-full text-sm text-muted-foreground bg-gray-50 rounded-md border border-border p-3 resize-none outline-none focus:ring-1 focus:ring-violet-300"
        />
        <div className="text-sm text-muted-foreground pt-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 mr-2">기간</span>
          {fmtDate(startDate)} — {fmtDate(endDate)}
        </div>
      </div>
    </div>
  );
}

// ─────────── KPI 카드 (스파크라인 포함) ───────────

function Sparkline({ data, dataKey, color }: { data: DailyPerformance[]; dataKey: keyof DailyPerformance | 'ctr' | 'cpc' | 'cvr' | 'cpa'; color: string }) {
  const enriched = data.map((d) => ({
    ...d,
    ctr: d.impressions ? (d.clicks / d.impressions) * 100 : 0,
    cpc: d.clicks ? d.cost / d.clicks : 0,
    cvr: d.clicks ? (d.conversions / d.clicks) * 100 : 0,
    cpa: d.conversions ? d.cost / d.conversions : 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={38}>
      <AreaChart data={enriched} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${String(dataKey)}-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey as string} stroke={color} strokeWidth={1.5}
              fill={`url(#spark-${String(dataKey)}-${color})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KpiCard({ label, value, sparkKey, daily, color = '#8b5cf6' }: {
  label: string; value: string; sparkKey?: keyof DailyPerformance | 'ctr' | 'cpc' | 'cvr' | 'cpa'; daily: DailyPerformance[]; color?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-3 flex flex-col">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-base font-bold mt-0.5">{value}</p>
      <div className="mt-1 -mx-1 -mb-1">
        {sparkKey && daily.length > 0 && <Sparkline data={daily} dataKey={sparkKey} color={color} />}
      </div>
    </div>
  );
}

function KpiPage({ data }: { data: DashboardData }) {
  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-sm font-semibold mb-3">실적 목록</h3>
      <div className="grid grid-cols-4 lg:grid-cols-5 gap-2 mb-6">
        <KpiCard label="광고비" value={fmtKRWShort(data.total.cost)} sparkKey="cost" daily={data.daily} color="#8b5cf6" />
        <KpiCard label="노출" value={fmtNumShort(data.total.impressions)} sparkKey="impressions" daily={data.daily} color="#6366f1" />
        <KpiCard label="클릭" value={fmtNumShort(data.total.clicks)} sparkKey="clicks" daily={data.daily} color="#3b82f6" />
        <KpiCard label="CTR" value={fmtPct(data.total.ctr)} sparkKey="ctr" daily={data.daily} color="#06b6d4" />
        <KpiCard label="CPC" value={fmtKRW(data.total.cpc)} sparkKey="cpc" daily={data.daily} color="#0ea5e9" />
        <KpiCard label="CPM" value={fmtKRWShort(data.total.cpm)} daily={data.daily} color="#10b981" />
        <KpiCard label="전환(리드수)" value={fmtNumShort(data.total.conversions)} sparkKey="conversions" daily={data.daily} color="#22c55e" />
        <KpiCard label="CVR" value={fmtPct(data.total.cvr)} sparkKey="cvr" daily={data.daily} color="#84cc16" />
        <KpiCard label="CPA" value={fmtKRW(data.total.cpa)} sparkKey="cpa" daily={data.daily} color="#f97316" />
        <KpiCard label="ROAS" value={fmtPct(data.total.roas)} daily={data.daily} color="#ef4444" />
      </div>

      <h3 className="text-sm font-semibold mb-2">채널별</h3>
      <div className="rounded-lg border border-border overflow-x-auto flex-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-border text-left text-muted-foreground">
              <th className="py-2 px-3">채널</th>
              <th className="py-2 px-3 text-right">광고비</th>
              <th className="py-2 px-3 text-right">노출</th>
              <th className="py-2 px-3 text-right">클릭</th>
              <th className="py-2 px-3 text-right">CTR</th>
              <th className="py-2 px-3 text-right">CPC</th>
              <th className="py-2 px-3 text-right">전환(리드수)</th>
              <th className="py-2 px-3 text-right">CPA</th>
              <th className="py-2 px-3 text-right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {data.byChannel.map((c) => (
              <tr key={c.channel} className="border-b border-border/50 hover:bg-gray-50">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[c.channel] }} />
                    <span className="font-medium">{c.label}</span>
                  </div>
                </td>
                <td className="py-2 px-3 text-right">{fmtKRW(c.cost)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(c.impressions)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(c.clicks)}</td>
                <td className="py-2 px-3 text-right">{fmtPct(c.ctr)}</td>
                <td className="py-2 px-3 text-right">{fmtKRW(c.cpc)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(c.conversions)}</td>
                <td className="py-2 px-3 text-right">{fmtKRW(c.cpa)}</td>
                <td className={`py-2 px-3 text-right font-semibold ${c.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(c.roas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────── 추이 페이지 ───────────

function TrendPage({ data }: { data: DashboardData }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="text-sm font-semibold">지출 (cost)</h3>
        <span className="text-xs text-muted-foreground">grouped by 채널</span>
      </div>
      <div className="rounded-lg border border-border bg-white p-4 flex-1 flex flex-col">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data.dailyByChannel} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
            <Tooltip formatter={(v) => fmtKRW(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="google" stackId="a" name={CHANNEL_LABEL.google} fill={CHANNEL_COLOR.google} />
            <Bar dataKey="meta" stackId="a" name={CHANNEL_LABEL.meta} fill={CHANNEL_COLOR.meta} />
            <Bar dataKey="naver" stackId="a" name={CHANNEL_LABEL.naver} fill={CHANNEL_COLOR.naver} />
            <Bar dataKey="kakao" stackId="a" name={CHANNEL_LABEL.kakao} fill={CHANNEL_COLOR.kakao} />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
          {data.byChannel.map((c) => {
            const totalCost = data.byChannel.reduce((s, x) => s + x.cost, 0);
            const pct = totalCost ? (c.cost / totalCost) * 100 : 0;
            return (
              <div key={c.channel} className="rounded-md border border-border p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[c.channel] }} />
                  <span className="font-medium truncate">{c.label}</span>
                </div>
                <div className="text-sm font-bold">{fmtKRWShort(c.cost)}</div>
                <div className="text-[10px] text-muted-foreground">{pct.toFixed(1)}% 비중</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────── 소재 페이지 ───────────

function CreativePage({ creatives }: { creatives: CreativePerformance[] }) {
  if (creatives.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">소재 데이터 로딩 중...</div>;
  }
  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-sm font-semibold mb-3">광고 소재 <span className="text-xs text-muted-foreground ml-2">상위 {Math.min(creatives.length, 8)}개 (광고비 기준)</span></h3>
      <div className="grid grid-cols-4 gap-3">
        {creatives.slice(0, 8).map((cr) => (
          <div key={cr.creativeId} className="rounded-lg border border-border bg-white overflow-hidden flex flex-col">
            <div className="h-28 flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: cr.thumbnailColor }}>
              <span className="absolute top-1.5 left-1.5 text-[9px] bg-white/90 rounded px-1.5 py-0.5 font-medium uppercase tracking-wider">
                {cr.format}
              </span>
              <span className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[cr.channel] }} title={CHANNEL_LABEL[cr.channel]} />
              <div className="px-3 text-white text-center">
                <p className="text-xs font-bold line-clamp-2">{cr.headline}</p>
              </div>
            </div>
            <div className="p-2.5 flex-1 flex flex-col">
              <p className="text-[11px] font-medium line-clamp-1" title={cr.creativeName}>{cr.creativeName}</p>
              <p className="text-[10px] text-muted-foreground line-clamp-1 mb-2">{cr.description}</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] mt-auto">
                <span className="text-muted-foreground">광고비</span>
                <span className="text-right font-medium">{fmtKRWShort(cr.cost)}</span>
                <span className="text-muted-foreground">노출</span>
                <span className="text-right">{fmtNumShort(cr.impressions)}</span>
                <span className="text-muted-foreground">클릭</span>
                <span className="text-right">{formatNumber(cr.clicks)}</span>
                <span className="text-muted-foreground">CTR</span>
                <span className="text-right">{fmtPct(cr.ctr)}</span>
                <span className="text-muted-foreground">ROAS</span>
                <span className={`text-right font-semibold ${cr.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(cr.roas)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── 메인 ───────────

export default function ReportBuilderPage() {
  const [startDate, setStartDate] = useState(offset(29));
  const [endDate, setEndDate] = useState(offset(0));
  const [currentPage, setCurrentPage] = useState<PageId>('cover');
  const [printAll, setPrintAll] = useState(false);
  const [title, setTitle] = useState('월간 광고 성과 리포트');
  const [subtitle, setSubtitle] = useState('Google · Meta · Naver · Kakao 통합 성과 요약 및 주요 인사이트');
  const [data, setData] = useState<DashboardData | null>(null);
  const [creatives, setCreatives] = useState<CreativePerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/ad-performance?view=dashboard&startDate=${startDate}&endDate=${endDate}`).then((r) => r.json()),
      fetch(`/api/ad-performance?view=creatives&startDate=${startDate}&endDate=${endDate}`).then((r) => r.json()),
    ]).then(([d, c]) => {
      if (!alive) return;
      setData(d);
      setCreatives(c.creatives || []);
      setLoading(false);
    }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [startDate, endDate]);

  const total = PAGES.length;
  const currentIdx = PAGES.findIndex((p) => p.id === currentPage) + 1;

  const exportCSV = () => {
    if (!data) return;
    const rows: (string | number)[][] = [];
    rows.push(['리포트 제목', title]);
    rows.push(['기간', `${startDate} ~ ${endDate}`]);
    rows.push([]);
    rows.push(['핵심 지표', '노출', '클릭', 'CTR', '광고비', 'CPC', 'CPM', '전환(리드수)', 'CVR', 'CPA', 'ROAS']);
    rows.push([
      '전체', data.total.impressions, data.total.clicks, data.total.ctr.toFixed(2),
      data.total.cost, data.total.cpc.toFixed(0), data.total.cpm.toFixed(0),
      data.total.conversions, data.total.cvr.toFixed(2), data.total.cpa.toFixed(0), data.total.roas.toFixed(2),
    ]);
    rows.push([]);
    rows.push(['채널별', '노출', '클릭', 'CTR', '광고비', 'CPC', '전환(리드수)', 'CPA', 'ROAS']);
    data.byChannel.forEach((c) => rows.push([
      c.label, c.impressions, c.clicks, c.ctr.toFixed(2),
      c.cost, c.cpc.toFixed(0), c.conversions, c.cpa.toFixed(0), c.roas.toFixed(2),
    ]));
    rows.push([]);
    rows.push(['광고 소재', '채널', '캠페인', '포맷', '광고비', '노출', '클릭', 'CTR', 'CPA', 'ROAS']);
    creatives.forEach((cr) => rows.push([
      cr.creativeName, CHANNEL_LABEL[cr.channel], cr.campaignName, cr.format,
      cr.cost, cr.impressions, cr.clicks, cr.ctr.toFixed(2), cr.cpa.toFixed(0), cr.roas.toFixed(2),
    ]));
    const csv = rows.map((r) => r.map((v) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ad-report-${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    setPrintAll(true);
    setTimeout(() => {
      window.print();
      setPrintAll(false);
    }, 100);
  };

  const renderPage = (id: PageId) => {
    if (!data) return null;
    switch (id) {
      case 'cover':
        return <CoverPage title={title} subtitle={subtitle} startDate={startDate} endDate={endDate}
                          onTitleChange={setTitle} onSubtitleChange={setSubtitle} />;
      case 'kpi':
        return <KpiPage data={data} />;
      case 'trend':
        return <TrendPage data={data} />;
      case 'creatives':
        return <CreativePage creatives={creatives} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 print:hidden">
          <h1 className="text-2xl font-bold">리포트 모드</h1>
          <p className="text-sm text-muted-foreground mt-1">표지 · 핵심 지표 · 추이 · 광고 소재 4페이지 리포트</p>
        </div>


        {/* 컨트롤 바 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
          <div className="flex gap-2">
            <button onClick={handlePrint} className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-muted bg-white">
              PDF / 인쇄
            </button>
            <button onClick={exportCSV} className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-muted bg-white">
              CSV 다운로드
            </button>
          </div>
        </div>

        {/* 페이지 탭 (Adriel 좌측 네비 스타일) */}
        <div className="flex gap-2 mb-4 print:hidden overflow-x-auto">
          {PAGES.map((p, i) => {
            const active = p.id === currentPage;
            return (
              <button
                key={p.id}
                onClick={() => setCurrentPage(p.id)}
                className={`text-sm rounded-md px-4 py-2 border transition-colors whitespace-nowrap ${
                  active
                    ? 'border-violet-500 bg-violet-50 text-violet-700 font-semibold'
                    : 'border-border bg-white text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="inline-block w-5 h-5 rounded-full bg-muted text-[10px] font-bold leading-5 text-center mr-2">
                  {i + 1}
                </span>
                {p.label}
              </button>
            );
          })}
        </div>

        {loading || !data ? (
          <div className="py-20 text-center text-muted-foreground">로딩 중...</div>
        ) : printAll ? (
          <div className="space-y-6 print:space-y-0">
            {PAGES.map((p, i) => (
              <PageFrame key={p.id} pageNum={i + 1} total={total}>
                {renderPage(p.id)}
              </PageFrame>
            ))}
          </div>
        ) : (
          <PageFrame pageNum={currentIdx} total={total}>
            {renderPage(currentPage)}
          </PageFrame>
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .report-page {
            page-break-after: always;
            break-after: page;
            border: none !important;
            box-shadow: none !important;
            max-width: none !important;
            width: 100% !important;
            min-height: 180mm !important;
          }
          .report-page:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
