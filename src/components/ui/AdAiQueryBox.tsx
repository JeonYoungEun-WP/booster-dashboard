'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatNumber } from '@/src/lib/format';
import { AiTableBlock, type TableBlockData } from './AiTableBlock';

const CHART_COLORS = ['#4285F4', '#1877F2', '#03C75A', '#FEE500', '#a855f7', '#f97316', '#ec4899', '#64748b'];

// 카테고리별 예시 — 광고 / 상담 / 최종 예약 / 풀 퍼널
const EXAMPLES: Array<{ label: string; category: '광고' | '상담' | '예약' | '통합' }> = [
  { label: '이벤트 1042 풀퍼널 진단해줘', category: '통합' },
  { label: '이벤트 3550 채널별 광고비 대비 최종 예약 ROAS', category: '통합' },
  { label: '채널별 CPA(리드) · CPA(예약) · CPA(결제) 표로', category: '통합' },
  { label: '상담 → 예약 전환율 낮은 광고세트 TOP 3', category: '상담' },
  { label: '리드는 많은데 최종 결제가 안 나오는 트래킹코드', category: '예약' },
  { label: 'Meta vs TikTok 풀 퍼널 비교', category: '광고' },
  { label: '광고비 재분배 시뮬레이션 (효율 낮은 세트 차감)', category: '광고' },
  { label: '최근 7일 일자별 리드·예약·결제 추이', category: '예약' },
];

interface SeriesDef { key: string; label: string; color?: string }
interface ChartBlock {
  title: string;
  type: 'bar' | 'line' | 'pie';
  data: { label: string; value: number; value2?: number; value3?: number; value4?: number }[];
  series?: SeriesDef[];
  valueLabel?: string;
  value2Label?: string;
}

function InlineChart({ chart }: { chart: ChartBlock }) {
  if (chart.type === 'pie') {
    return (
      <div className="my-3 rounded-lg border border-border bg-background p-4">
        <p className="text-sm font-semibold mb-2">{chart.title}</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={chart.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80}
              label={({ name, value }) => `${name}: ${formatNumber(Number(value))}`}>
              {chart.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => formatNumber(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }
  const seriesList: SeriesDef[] = chart.series || [
    { key: 'value', label: chart.valueLabel || '값', color: CHART_COLORS[0] },
    ...(chart.data.some(d => d.value2 !== undefined) ? [{ key: 'value2', label: chart.value2Label || '비교', color: CHART_COLORS[1] }] : []),
  ];

  const ChartComp = chart.type === 'line' ? LineChart : BarChart;
  return (
    <div className="my-3 rounded-lg border border-border bg-background p-4">
      <p className="text-sm font-semibold mb-2">{chart.title}</p>
      <ResponsiveContainer width="100%" height={260}>
        <ChartComp data={chart.data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => formatNumber(Number(v))} />
          {seriesList.map((s, i) => (
            chart.type === 'line' ? (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label}
                stroke={s.color || CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }}
                strokeDasharray={i >= 2 ? '5 5' : undefined} />
            ) : (
              <Bar key={s.key} dataKey={s.key} name={s.label}
                fill={s.color || CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
            )
          ))}
        </ChartComp>
      </ResponsiveContainer>
    </div>
  );
}

// 마크다운 표는 대시보드 테이블과 유사한 스타일 — 헤더 배경·striped 행·tabular-nums·overflow-x
const MD_CLASSES = `max-w-none text-sm leading-relaxed
  [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-sm [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:border [&_table]:border-border
  [&_thead]:bg-muted/40
  [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-xs [&_th]:text-muted-foreground [&_th]:border-b [&_th]:border-border [&_th]:whitespace-nowrap
  [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-border/50 [&_td]:tabular-nums
  [&_tbody_tr:nth-child(even)]:bg-muted/10
  [&_tbody_tr:hover]:bg-muted/20
  [&_tbody_tr:last-child_td]:border-b-0
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1
  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1
  [&_li]:leading-relaxed
  [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
  [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2
  [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1
  [&_p]:my-1.5 [&_strong]:font-bold
  [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs`;

export function AdAiQueryBox() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/ad-chat' }), []);

  const { messages, sendMessage, status, setMessages, error } = useChat({ transport });

  const isLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage({ text: inputValue });
    setInputValue('');
  };

  const handleClear = () => setMessages([]);

  const getCharts = (parts: typeof messages[0]['parts']): ChartBlock[] => {
    const charts: ChartBlock[] = [];
    for (const part of parts) {
      if (part.type === 'tool-chartData' || (part.type === 'dynamic-tool' && 'toolName' in part && (part as unknown as { toolName: string }).toolName === 'chartData')) {
        const p = part as unknown as { input?: unknown };
        if (p.input) {
          const args = p.input as ChartBlock;
          if (args?.data) charts.push(args);
        }
      }
    }
    return charts;
  };

  const getTables = (parts: typeof messages[0]['parts']): TableBlockData[] => {
    const tables: TableBlockData[] = [];
    for (const part of parts) {
      if (part.type === 'tool-tableData' || (part.type === 'dynamic-tool' && 'toolName' in part && (part as unknown as { toolName: string }).toolName === 'tableData')) {
        const p = part as unknown as { input?: unknown };
        if (p.input) {
          const args = p.input as TableBlockData;
          if (args?.columns && args?.rows) tables.push(args);
        }
      }
    }
    return tables;
  };

  const getTextContent = (parts: typeof messages[0]['parts']): string => {
    return parts
      .filter(p => p.type === 'text')
      .map(p => (p as { type: 'text'; text: string }).text)
      .join('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="rounded-xl bg-brand-gradient text-white p-3 mb-5 shadow-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h2 className="text-lg font-bold mb-2">
              <span className="lowercase">ai</span> <span className="text-brand-gradient">MAX</span> 풀 퍼널 분석
            </h2>
            <p className="text-muted-foreground text-sm mb-1 max-w-md">
              광고 · 상담 · 최종 예약까지 전체 퍼널 데이터를 통합 분석합니다.
            </p>
            <p className="text-muted-foreground/70 text-xs mb-6">
              Google · Meta · Naver · Kakao · TikTok · 당근 + 이벤트 랜딩 퍼널 (리드 → 상담 → 예약 → 결제)
            </p>

            {/* 카테고리 태그 */}
            <div className="flex flex-wrap justify-center gap-1.5 mb-4">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">통합 퍼널</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">광고 성과</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-semibold">상담 성과</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">최종 예약 성과</span>
            </div>

            <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
              {EXAMPLES.map((ex) => {
                const catColor: Record<string, string> = {
                  '통합': 'border-primary/30 text-primary hover:bg-primary/5',
                  '광고': 'border-amber-200 text-amber-700 hover:bg-amber-50',
                  '상담': 'border-sky-200 text-sky-700 hover:bg-sky-50',
                  '예약': 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
                }
                return (
                  <button
                    key={ex.label}
                    onClick={() => setInputValue(ex.label)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${catColor[ex.category]}`}
                  >
                    {ex.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === 'user') {
            const text = getTextContent(msg.parts);
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-xl px-4 py-3 bg-primary text-primary-foreground">
                  <p className="text-sm">{text}</p>
                </div>
              </div>
            );
          }

          const text = getTextContent(msg.parts);
          const charts = getCharts(msg.parts);
          const tables = getTables(msg.parts);
          const hasToolCalls = msg.parts.some(p => p.type === 'tool-invocation');
          const isThinking = hasToolCalls && !text;

          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[92%] rounded-xl px-4 py-3 bg-muted/50">
                {isThinking && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    광고 데이터를 조회하고 분석하는 중...
                  </div>
                )}
                {text && (
                  <div className={MD_CLASSES}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                  </div>
                )}
                {tables.map((t, i) => (
                  <AiTableBlock key={`t${i}`} data={t} />
                ))}
                {charts.map((chart, i) => (
                  <InlineChart key={`c${i}`} chart={chart} />
                ))}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted/50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                광고 데이터를 조회하고 분석하는 중...
              </div>
            </div>
          </div>
        )}
      </div>

      {status !== 'ready' && (
        <div className={`px-4 py-1 text-xs border-t ${
          status === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'text-muted-foreground bg-muted/30 border-border'
        }`}>
          상태: {status} | 메시지: {messages.length}개
        </div>
      )}
      {error && (
        <div className="px-4 py-3 text-sm bg-red-50 text-red-800 border-t border-red-200 whitespace-pre-wrap">
          <strong>AI 에러:</strong> {error.message || String(error)}
        </div>
      )}

      <div className="sticky bottom-0 border-t border-border bg-card p-4">
        {messages.length > 0 && (
          <div className="flex justify-end mb-2">
            <button onClick={handleClear} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              대화 초기화
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={messages.length === 0 ? '광고 · 상담 · 예약 성과를 풀 퍼널로 물어보세요...' : '이어서 질문하세요...'}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !inputValue.trim()} className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap">
            {isLoading ? '분석 중...' : '전송'}
          </button>
        </form>
      </div>
    </div>
  );
}
