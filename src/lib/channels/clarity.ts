/**
 * Microsoft Clarity Data Export API 어댑터
 *
 * 엔드포인트: https://www.clarity.ms/export-data/api/v1/project-live-insights
 *   Method: POST (또는 GET; 공식 문서는 GET 기준이지만 POST 도 허용)
 *   Auth:   Authorization: Bearer <CLARITY_API_TOKEN>
 *
 * 제약:
 *   - numOfDays: 1 / 2 / 3 만 지원 (자유 날짜 범위 불가)
 *   - 프로젝트당 하루 10회 호출 한도
 *   - dimension1, dimension2, dimension3 각각 옵션: Browser · Device · OS · Country · URL · Referrer
 *
 * 전략:
 *   UI 날짜 범위와 무관하게 numOfDays = min(3, range) 호출 후
 *   응답에서 URL 이 이벤트 랜딩 경로로 시작하는 row 만 합산 → 이벤트 단위 인사이트.
 *   15분 모듈 스코프 캐시 + rate limit 시 stale 폴백.
 */

const ENDPOINT = 'https://www.clarity.ms/export-data/api/v1/project-live-insights'
const CACHE_TTL_MS = 15 * 60 * 1000  // 15분

export function hasClarityCreds(): boolean {
  return !!process.env.CLARITY_PROJECT_ID && !!process.env.CLARITY_API_TOKEN
}

export interface ClarityMetric {
  metricName: string
  information: Array<Record<string, string | number>>
}

export interface ClarityInsights {
  totalSessions: number
  pageViews: number
  scrollDepth: number           // 평균 스크롤 깊이 (%)
  deadClickPct: number          // Dead click 발생 세션 비율
  rageClickPct: number          // Rage click 발생 세션 비율
  quickBackPct: number          // Quick back 발생 세션 비율
  excessiveScrollPct: number    // Excessive scrolling 세션 비율
  byDevice: Array<{ device: string; sessions: number }>
  byUrl: Array<{ url: string; sessions: number; pageViews: number }>
  fetchedAt: string
  numOfDays: 1 | 2 | 3
  stale?: boolean
}

export type ClarityResult =
  | ClarityInsights
  | { unavailable: true; reason: 'no_creds' | 'rate_limit' | 'error'; message?: string }

// ───── 캐시 ─────
const cache = new Map<string, { ts: number; data: ClarityInsights }>()

function cacheKey(projectId: string, numOfDays: number): string {
  return `${projectId}:${numOfDays}`
}

function isFresh(entry: { ts: number }): boolean {
  return Date.now() - entry.ts < CACHE_TTL_MS
}

// ───── Clarity API 호출 ─────

async function callClarity(numOfDays: 1 | 2 | 3): Promise<ClarityMetric[]> {
  const token = process.env.CLARITY_API_TOKEN!
  // Clarity 는 dimension 파라미터를 URL 쿼리로 받음 (GET)
  const url = new URL(ENDPOINT)
  url.searchParams.set('numOfDays', String(numOfDays))
  url.searchParams.set('dimension1', 'URL')
  url.searchParams.set('dimension2', 'Device')

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    // Next.js 서버 컴포넌트/라우트에서 캐시 제어
    cache: 'no-store',
  })

  if (res.status === 429 || res.status === 403) {
    throw Object.assign(new Error(`Clarity rate limit: ${res.status}`), { code: 'rate_limit' })
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw Object.assign(new Error(`Clarity API ${res.status}: ${text.slice(0, 200)}`), { code: 'error' })
  }
  const data = (await res.json()) as ClarityMetric[] | { metrics: ClarityMetric[] }
  return Array.isArray(data) ? data : (data.metrics ?? [])
}

// ───── 응답 파싱 (도메인 지식 + 방어 코드) ─────
//
// Clarity 응답은 metricName 별로 information 배열을 반환.
// 대표 metricName: "Traffic", "Popular pages", "Rage click", "Dead click",
//                  "Quick backs", "Excessive scrolling", "Scroll depth"
//
// information 의 키는 메트릭/차원에 따라 다름 (대표적으로 "URL", "Device",
// "sessionsCount", "pagesPerSession", "rageClickCount" 등).
// 응답 형태가 일관되지 않을 수 있어 느슨한 접근자로 합산.

function num(row: Record<string, string | number>, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k]
    if (v === undefined) continue
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''))
    if (Number.isFinite(n)) return n
  }
  return 0
}

function str(row: Record<string, string | number>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  return ''
}

function parseInsights(
  metrics: ClarityMetric[],
  eventPaths: string[],
  numOfDays: 1 | 2 | 3,
): ClarityInsights {
  const eventPathLower = eventPaths.map((p) => p.toLowerCase())
  const matchEventUrl = (url: string): boolean => {
    if (!url) return false
    const lower = url.toLowerCase()
    return eventPathLower.some((p) => {
      // Clarity URL 은 상대 경로일 수도, 전체 URL 일 수도 있어 둘 다 처리
      if (lower.startsWith(p)) return true
      if (lower.includes(p + '/')) return true
      if (lower.endsWith(p)) return true
      return false
    })
  }

  // URL 별 집계 (Traffic / Popular pages 등에 URL 차원으로 담김)
  const urlAgg = new Map<string, { sessions: number; pageViews: number }>()
  const deviceAgg = new Map<string, number>()

  let totalSessions = 0
  let pageViews = 0
  let scrollDepthSum = 0
  let scrollDepthCount = 0
  let deadClickEvents = 0
  let rageClickEvents = 0
  let quickBackEvents = 0
  let excessiveScrollEvents = 0

  for (const m of metrics) {
    const name = m.metricName || ''
    const info = Array.isArray(m.information) ? m.information : []

    for (const row of info) {
      const url = str(row, 'URL', 'Url', 'url', 'PageUrl')
      const device = str(row, 'Device', 'device')
      const sessions = num(row, 'sessionsCount', 'sessions', 'totalSessionCount')
      const views = num(row, 'pagesViewCount', 'pageViews', 'pagesPerSession')

      const urlMatches = url ? matchEventUrl(url) : false
      // URL 필터가 있으면 매칭된 것만 포함. URL 차원이 없는 metric (예: 'Traffic' 전체)
      // 은 이벤트 단위 집계 대상에서 제외 (전체 집계는 별도 metric 으로 빠져 나옴).
      const shouldInclude = url ? urlMatches : false

      if (shouldInclude) {
        const prev = urlAgg.get(url) ?? { sessions: 0, pageViews: 0 }
        urlAgg.set(url, {
          sessions: prev.sessions + sessions,
          pageViews: prev.pageViews + views,
        })
        totalSessions += sessions
        pageViews += views

        if (device) {
          deviceAgg.set(device, (deviceAgg.get(device) ?? 0) + sessions)
        }
      }

      // 이벤트 단위 문제 메트릭 (가능한 경우 URL 매칭으로 한정)
      if (!url || urlMatches) {
        const lower = name.toLowerCase()
        if (lower.includes('dead click')) {
          deadClickEvents += num(row, 'deadClickCount', 'count', 'sessionsCount')
        } else if (lower.includes('rage click')) {
          rageClickEvents += num(row, 'rageClickCount', 'count', 'sessionsCount')
        } else if (lower.includes('quick back')) {
          quickBackEvents += num(row, 'quickBackCount', 'count', 'sessionsCount')
        } else if (lower.includes('excessive scroll')) {
          excessiveScrollEvents += num(row, 'excessiveScrollingCount', 'count', 'sessionsCount')
        } else if (lower.includes('scroll depth')) {
          const depth = num(row, 'averageScrollDepth', 'avgScrollDepth', 'depth')
          if (depth > 0) {
            scrollDepthSum += depth
            scrollDepthCount += 1
          }
        }
      }
    }
  }

  const pct = (ev: number): number =>
    totalSessions > 0 ? Math.min(100, (ev / totalSessions) * 100) : 0

  return {
    totalSessions,
    pageViews,
    scrollDepth: scrollDepthCount > 0 ? scrollDepthSum / scrollDepthCount : 0,
    deadClickPct: pct(deadClickEvents),
    rageClickPct: pct(rageClickEvents),
    quickBackPct: pct(quickBackEvents),
    excessiveScrollPct: pct(excessiveScrollEvents),
    byDevice: Array.from(deviceAgg.entries())
      .map(([device, sessions]) => ({ device, sessions }))
      .sort((a, b) => b.sessions - a.sessions),
    byUrl: Array.from(urlAgg.entries())
      .map(([url, v]) => ({ url, sessions: v.sessions, pageViews: v.pageViews }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 20),
    fetchedAt: new Date().toISOString(),
    numOfDays,
  }
}

// ───── 공개 API ─────

/** 날짜 범위 (일 단위) → Clarity 가 지원하는 1/2/3 으로 매핑 */
export function dateRangeToClarityDays(startDate: string, endDate: string): 1 | 2 | 3 {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
  if (diffDays <= 1) return 1
  if (diffDays <= 2) return 2
  return 3
}

/**
 * 이벤트 랜딩 URL 에 해당하는 Clarity 인사이트 조회.
 *
 * @param eventPaths - 이 중 어느 경로로든 매치되면 포함 (예: ['/tasks/1042', '/event/1042', '/nexentire_rental'])
 * @param numOfDays  - 1 | 2 | 3
 */
export async function getEventInsights(
  eventPaths: string[],
  numOfDays: 1 | 2 | 3 = 3,
): Promise<ClarityResult> {
  if (!hasClarityCreds()) {
    return { unavailable: true, reason: 'no_creds' }
  }

  const projectId = process.env.CLARITY_PROJECT_ID!
  const key = cacheKey(projectId, numOfDays)
  const cached = cache.get(key)

  try {
    const metrics = await callClarity(numOfDays)
    const insights = parseInsights(metrics, eventPaths, numOfDays)
    cache.set(key, { ts: Date.now(), data: insights })
    return insights
  } catch (e) {
    const code = (e as { code?: string }).code
    if (cached) {
      // rate limit / error 어느 경우든 stale 캐시 우선 반환
      return {
        ...parseInsights(
          // parseInsights 는 metric 기반 — 캐시된 건 이미 파싱된 값이라 그대로 반환하되 stale 플래그
          [],
          eventPaths,
          numOfDays,
        ),
        ...cached.data,
        stale: true,
      }
    }
    const reason = code === 'rate_limit' ? 'rate_limit' : 'error'
    return { unavailable: true, reason, message: (e as Error).message }
  }
}

/** 프로젝트 레벨 Clarity 콘솔 링크 (세션 녹화 열람용) */
export function getClarityConsoleUrl(): string | null {
  const pid = process.env.CLARITY_PROJECT_ID
  if (!pid) return null
  return `https://clarity.microsoft.com/projects/view/${pid}/dashboard`
}

export async function healthCheck(): Promise<{
  ok: boolean
  credsPresent: boolean
  error?: string
  totalSessions?: number
}> {
  const credsPresent = hasClarityCreds()
  if (!credsPresent) return { ok: false, credsPresent, error: 'CLARITY_PROJECT_ID/TOKEN not set' }
  try {
    const metrics = await callClarity(1)
    const parsed = parseInsights(metrics, ['/'], 1)
    return { ok: true, credsPresent, totalSessions: parsed.totalSessions }
  } catch (e) {
    return { ok: false, credsPresent, error: (e as Error).message }
  }
}
