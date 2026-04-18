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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/ad-performance?view=dashboard&startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [startDate, endDate]);

  const channelPie = useMemo(() => data?.byChannel.map((c) => ({ label: c.label, value: c.cost, channel: c.channel })) || [], [data]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">광고성과분석</h1>
          <p className="text-sm text-muted-foreground mt-1">Google · Meta · Naver · Kakao 통합 광고 성과</p>
        </div>


        <div className="flex justify-end mb-4">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        </div>

        {loading || !data ? (
          <div className="py-20 text-center text-muted-foreground">로딩 중...</div>
        ) : (
          <>
            {/* KPI 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <KpiCard label="노출수" value={formatNumber(data.total.impressions)} />
              <KpiCard label="클릭수" value={formatNumber(data.total.clicks)} sub={`CTR ${fmtPct(data.total.ctr)}`} />
              <KpiCard label="광고비" value={fmtKRW(data.total.cost)} sub={`CPC ${fmtKRW(data.total.cpc)}`} />
              <KpiCard label="전환수" value={formatNumber(data.total.conversions)} sub={`CVR ${fmtPct(data.total.cvr)}`} />
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
                    <Line yAxisId="right" type="monotone" dataKey="conversions" name="전환" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
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
                      <th className="py-2 px-3 text-right">전환</th>
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
                      <th className="py-2 px-3 text-right">전환</th>
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
