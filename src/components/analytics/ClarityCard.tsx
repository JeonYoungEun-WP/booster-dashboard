'use client'

import { ExternalLink } from 'lucide-react'

interface ClaritySuccess {
  totalSessions: number
  pageViews: number
  scrollDepth: number
  deadClickPct: number
  rageClickPct: number
  quickBackPct: number
  excessiveScrollPct: number
  byDevice: Array<{ device: string; sessions: number }>
  byUrl?: Array<{ url: string; sessions: number; pageViews: number }>
  fetchedAt: string
  numOfDays: 1 | 2 | 3
  stale?: boolean
  consoleUrl?: string | null
}

interface ClarityUnavailable {
  unavailable: true
  reason: string
  message?: string
  consoleUrl?: string | null
}

interface ClarityError {
  error: string
}

export type ClarityCardData = ClaritySuccess | ClarityUnavailable | ClarityError

function isSuccess(d: ClarityCardData): d is ClaritySuccess {
  return 'totalSessions' in d
}
function isUnavailable(d: ClarityCardData): d is ClarityUnavailable {
  return 'unavailable' in d && d.unavailable === true
}

function Gauge({ label, value, suffix = '%', danger = false }: { label: string; value: number; suffix?: string; danger?: boolean }) {
  const display = Number.isFinite(value) ? value.toFixed(1) : '0.0'
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${danger && value > 10 ? 'text-amber-600' : ''}`}>
        {display}{suffix}
      </p>
    </div>
  )
}

export function ClarityCard({ data }: { data: ClarityCardData }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Microsoft Clarity — UX 인사이트</h2>
          {isSuccess(data) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              🔴 실시간 · 최근 {data.numOfDays}일
            </span>
          )}
          {isSuccess(data) && data.stale && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              캐시
            </span>
          )}
        </div>
        {'consoleUrl' in data && data.consoleUrl && (
          <a
            href={data.consoleUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline"
          >
            녹화 보기 <ExternalLink size={12} />
          </a>
        )}
      </div>
      {isSuccess(data) && (
        <p className="text-[11px] text-muted-foreground -mt-1 mb-3">
          Clarity API 는 최근 3일까지만 제공 — 조회 기간과 무관하게 실시간 최근 데이터 표시
        </p>
      )}

      {isUnavailable(data) && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
          Clarity 미연결 — {data.reason === 'no_creds'
            ? 'CLARITY_PROJECT_ID / CLARITY_API_TOKEN 을 설정해주세요'
            : data.reason === 'rate_limit'
              ? '일일 호출 한도 초과 (최대 10회/일) — 잠시 후 다시 시도'
              : (data.message || data.reason)}
        </div>
      )}

      {'error' in data && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Clarity 호출 실패: {data.error}
        </div>
      )}

      {isSuccess(data) && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Gauge label="스크롤 깊이" value={data.scrollDepth} />
            <Gauge label="Rage click" value={data.rageClickPct} danger />
            <Gauge label="Dead click" value={data.deadClickPct} danger />
            <Gauge label="Quick back" value={data.quickBackPct} danger />
            <Gauge label="Excessive" value={data.excessiveScrollPct} danger />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground">세션</p>
              <p className="text-lg font-bold">{Math.round(data.totalSessions).toLocaleString('ko-KR')}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[11px] text-muted-foreground">페이지뷰</p>
              <p className="text-lg font-bold">{Math.round(data.pageViews).toLocaleString('ko-KR')}</p>
            </div>
          </div>
          {data.byDevice.length > 0 && (
            <div className="pt-1">
              <p className="text-[11px] text-muted-foreground mb-1.5">디바이스 분포</p>
              <div className="flex flex-wrap gap-1.5">
                {data.byDevice.slice(0, 5).map((d) => (
                  <span key={d.device} className="text-[11px] rounded-full bg-muted px-2 py-0.5">
                    {d.device} <span className="text-muted-foreground">· {d.sessions}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
