'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { DateRangePicker } from '@/src/components/ui/DateRangePicker';
import { ChannelIcon } from '@/src/components/ui/ChannelIcon';
import { formatNumber } from '@/src/lib/format';
import { CHANNEL_COLOR, CHANNEL_LABEL, type AdChannel, type AdMetrics, type ChannelPerformance, type DailyPerformance, type CampaignPerformance, type IntegrationStatus } from '@/src/lib/ad-data';

interface GA4Summary {
  period: { startDate: string; endDate: string };
  propertyId: string;
  totals: {
    sessions: number; activeUsers: number; newUsers: number;
    conversions: number; totalRevenue: number;
    engagementRate: number; averageSessionDuration: number;
  };
  byChannel: { channel: string; sessions: number; activeUsers: number; conversions: number; totalRevenue: number }[];
  bySource: { source: string; medium: string; campaign: string; sessions: number; conversions: number }[];
}

interface DashboardData {
  period: { startDate: string; endDate: string };
  total: AdMetrics;
  byChannel: ChannelPerformance[];
  daily: DailyPerformance[];
  dailyByChannel: { date: string; google: number; meta: number; naver: number; kakao: number }[];
  topCampaigns: CampaignPerformance[];
  integrations: IntegrationStatus[];
}

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

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent || ''}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function AdPerformanceDashboard() {
  const [startDate, setStartDate] = useState(offset(29));
  const [endDate, setEndDate] = useState(offset(0));
  const [data, setData] = useState<DashboardData | null>(null);
  const [ga4, setGa4] = useState<GA4Summary | null>(null);
  const [ga4Error, setGa4Error] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/ad-performance?view=dashboard&startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    // GA4는 별도 페치 (실패해도 광고 대시보드는 계속 표시)
    setGa4(null); setGa4Error(null);
    fetch(`/api/ga4?view=summary&startDate=${startDate}&endDate=${endDate}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
          setGa4Error(err.error || err.hint || `HTTP ${r.status}`);
          return;
        }
        setGa4(await r.json());
      })
      .catch((e) => setGa4Error((e as Error).message));
  }, [startDate, endDate]);

  const channelPie = useMemo(() => data?.byChannel.map((c) => ({ label: c.label, value: c.cost, channel: c.channel })) || [], [data]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">광고성과분석</h1>
          <p className="text-sm text-muted-foreground mt-1">heypick.co.kr · Google · Meta · Naver · Kakao · TikTok · 당근 통합</p>
        </div>


        <div className="flex justify-end mb-4">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        </div>

        {/* heypick.co.kr GA4 트래픽 요약 */}
        <section className="mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold">
              <span className="inline-flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-blue-50 text-blue-600 inline-flex items-center justify-center text-[10px] font-bold">GA</span>
                heypick.co.kr 트래픽
              </span>
            </h2>
            {ga4 && <span className="text-[11px] text-muted-foreground">Property: {ga4.propertyId}</span>}
          </div>
          {ga4Error ? (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium mb-1">GA4 연결 필요</p>
              <p className="text-xs mb-2">{ga4Error}</p>
              <p className="text-xs text-amber-800">
                Vercel Environment Variables 에 <code>GA4_PROPERTY_ID=436683873</code> + GCP Workload Identity 필드
                (<code>GCP_PROJECT_NUMBER</code>, <code>GCP_WORKLOAD_IDENTITY_POOL_ID</code>,
                <code>GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID</code>, <code>GCP_SERVICE_ACCOUNT_EMAIL</code>) 를 설정하세요.
              </p>
            </div>
          ) : !ga4 ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">로딩 중...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <KpiCard label="세션" value={formatNumber(ga4.totals.sessions)} />
              <KpiCard label="활성 사용자" value={formatNumber(ga4.totals.activeUsers)}
                       sub={`신규 ${formatNumber(ga4.totals.newUsers)}`} />
              <KpiCard label="전환(리드수)" value={formatNumber(ga4.totals.conversions)} accent="text-emerald-600" />
              <KpiCard label="매출"
                       value={ga4.totals.totalRevenue ? '₩' + Math.round(ga4.totals.totalRevenue).toLocaleString('ko-KR') : '-'} />
              <KpiCard label="참여율" value={fmtPct(ga4.totals.engagementRate * 100)} />
              <KpiCard label="평균 세션" value={`${Math.round(ga4.totals.averageSessionDuration)}초`} />
            </div>
          )}

          {ga4 && ga4.byChannel.length > 0 && (
            <div className="mt-3 rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold mb-2 text-muted-foreground">세션 채널 그룹</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-1.5 px-2">채널 그룹</th>
                      <th className="py-1.5 px-2 text-right">세션</th>
                      <th className="py-1.5 px-2 text-right">활성 사용자</th>
                      <th className="py-1.5 px-2 text-right">전환(리드수)</th>
                      <th className="py-1.5 px-2 text-right">매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ga4.byChannel.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-1.5 px-2 font-medium">{r.channel}</td>
                        <td className="py-1.5 px-2 text-right">{formatNumber(r.sessions)}</td>
                        <td className="py-1.5 px-2 text-right">{formatNumber(r.activeUsers)}</td>
                        <td className="py-1.5 px-2 text-right text-emerald-700">{formatNumber(r.conversions)}</td>
                        <td className="py-1.5 px-2 text-right">{r.totalRevenue ? fmtKRW(r.totalRevenue) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {loading || !data ? (
          <div className="py-20 text-center text-muted-foreground">로딩 중...</div>
        ) : (
          <>
            {/* KPI 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <KpiCard label="노출수" value={formatNumber(data.total.impressions)} />
              <KpiCard label="클릭수" value={formatNumber(data.total.clicks)} sub={`CTR ${fmtPct(data.total.ctr)}`} />
              <KpiCard label="광고비" value={fmtKRW(data.total.cost)} sub={`CPC ${fmtKRW(data.total.cpc)}`} />
              <KpiCard label="전환수(리드수)" value={formatNumber(data.total.conversions)} sub={`CVR ${fmtPct(data.total.cvr)}`} />
              <KpiCard label="CPA" value={fmtKRW(data.total.cpa)} accent="text-orange-600" />
              <KpiCard label="ROAS" value={fmtPct(data.total.roas)} accent={data.total.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'} />
            </div>

            {/* 메인 차트 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold mb-3">일자별 비용 / 클릭 추이</p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v, n) => [n === '비용' ? fmtKRW(Number(v)) : formatNumber(Number(v)), n]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="left" type="monotone" dataKey="cost" name="비용" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                    <Line yAxisId="right" type="monotone" dataKey="clicks" name="클릭" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
                    <Line yAxisId="right" type="monotone" dataKey="conversions" name="전환(리드수)" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold mb-3">채널별 광고비 비중</p>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={channelPie} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                      {channelPie.map((c, i) => <Cell key={i} fill={CHANNEL_COLOR[c.channel as AdChannel] || '#888'} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtKRW(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 채널별 성과 테이블 */}
            <div className="rounded-xl border border-border bg-card p-4 mb-6">
              <p className="text-sm font-semibold mb-3">채널별 성과 비교</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 px-3">채널</th>
                      <th className="py-2 px-3 text-right">노출</th>
                      <th className="py-2 px-3 text-right">클릭</th>
                      <th className="py-2 px-3 text-right">CTR</th>
                      <th className="py-2 px-3 text-right">비용</th>
                      <th className="py-2 px-3 text-right">CPC</th>
                      <th className="py-2 px-3 text-right">전환(리드수)</th>
                      <th className="py-2 px-3 text-right">CVR</th>
                      <th className="py-2 px-3 text-right">CPA</th>
                      <th className="py-2 px-3 text-right">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byChannel.map((c) => (
                      <tr key={c.channel} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <ChannelIcon channel={c.channel} size={16} />
                            <span className="font-medium">{c.label}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.impressions)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.clicks)}</td>
                        <td className="py-2 px-3 text-right">{fmtPct(c.ctr)}</td>
                        <td className="py-2 px-3 text-right">{fmtKRW(c.cost)}</td>
                        <td className="py-2 px-3 text-right">{fmtKRW(c.cpc)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.conversions)}</td>
                        <td className="py-2 px-3 text-right">{fmtPct(c.cvr)}</td>
                        <td className="py-2 px-3 text-right">{fmtKRW(c.cpa)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${c.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(c.roas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 채널별 일자 비용 스택 */}
            <div className="rounded-xl border border-border bg-card p-4 mb-6">
              <p className="text-sm font-semibold mb-3">일자별 채널별 비용 (스택)</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.dailyByChannel} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                  <Tooltip formatter={(v) => fmtKRW(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="google" stackId="a" name={CHANNEL_LABEL.google} fill={CHANNEL_COLOR.google} />
                  <Bar dataKey="meta" stackId="a" name={CHANNEL_LABEL.meta} fill={CHANNEL_COLOR.meta} />
                  <Bar dataKey="naver" stackId="a" name={CHANNEL_LABEL.naver} fill={CHANNEL_COLOR.naver} />
                  <Bar dataKey="kakao" stackId="a" name={CHANNEL_LABEL.kakao} fill={CHANNEL_COLOR.kakao} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* TOP 캠페인 */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-3">상위 캠페인 TOP 10 (광고비 기준)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 px-3">캠페인</th>
                      <th className="py-2 px-3">채널</th>
                      <th className="py-2 px-3">상태</th>
                      <th className="py-2 px-3 text-right">비용</th>
                      <th className="py-2 px-3 text-right">전환(리드수)</th>
                      <th className="py-2 px-3 text-right">CPA</th>
                      <th className="py-2 px-3 text-right">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCampaigns.map((c, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{c.campaignName}</td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <ChannelIcon channel={c.channel} size={14} />
                            {CHANNEL_LABEL[c.channel]}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-xs rounded-full px-2 py-0.5 ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                            {c.status === 'ACTIVE' ? '진행 중' : '일시중지'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">{fmtKRW(c.cost)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.conversions)}</td>
                        <td className="py-2 px-3 text-right">{fmtKRW(c.cpa)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${c.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(c.roas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
