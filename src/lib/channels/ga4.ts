/**
 * Google Analytics 4 (GA4) Data API 클라이언트
 *
 * heypick.co.kr property: 436683873
 *
 * 공식 문서: https://developers.google.com/analytics/devguides/reporting/data/v1
 * REST Base: https://analyticsdata.googleapis.com/v1beta
 *
 * ⚠️ GA4 는 매체 API가 아니므로 허가 IP 제약(222.109.27.119) 대상이 아님.
 *    Vercel 서버리스에서 직접 호출 가능.
 *
 * 인증 우선순위:
 *   (1) GCP_SA_KEY_JSON     — 서비스 계정 JSON (문자열) 있으면 사용
 *   (2) Workload Identity Federation — @vercel/functions 의 OIDC 토큰 → STS 교환 → SA 토큰 impersonate
 *   (3) Application Default Credentials (로컬 개발용 gcloud auth)
 *
 * 필요 환경변수:
 * - GA4_PROPERTY_ID              (예: "436683873")
 * - 인증 (1): GCP_SA_KEY_JSON
 * - 인증 (2): GCP_PROJECT_NUMBER, GCP_WORKLOAD_IDENTITY_POOL_ID,
 *              GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID, GCP_SERVICE_ACCOUNT_EMAIL
 */

import { GoogleAuth } from 'google-auth-library'
import { getVercelOidcToken } from '@vercel/functions/oidc'

const BASE_URL = 'https://analyticsdata.googleapis.com/v1beta'

function getPropertyId(): string {
  const id = process.env.GA4_PROPERTY_ID
  if (!id) throw new Error('GA4_PROPERTY_ID missing')
  return id.startsWith('properties/') ? id : `properties/${id}`
}

export function hasGA4Creds(): boolean {
  return !!process.env.GA4_PROPERTY_ID && (
    !!process.env.GCP_SA_KEY_JSON ||
    (!!process.env.GCP_PROJECT_NUMBER && !!process.env.GCP_WORKLOAD_IDENTITY_POOL_ID &&
     !!process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID && !!process.env.GCP_SERVICE_ACCOUNT_EMAIL)
  )
}

async function getAccessToken(): Promise<string> {
  // (1) 서비스 계정 JSON 직접 주입
  const keyJson = process.env.GCP_SA_KEY_JSON
  if (keyJson) {
    const auth = new GoogleAuth({
      credentials: JSON.parse(keyJson),
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
    const client = await auth.getClient()
    const { token } = await client.getAccessToken()
    if (!token) throw new Error('Failed to get GA4 access token from SA JSON')
    return token
  }

  // (2) Workload Identity Federation on Vercel
  const projectNumber = process.env.GCP_PROJECT_NUMBER
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL

  if (projectNumber && poolId && providerId && serviceAccountEmail && process.env.VERCEL) {
    const oidcToken = await getVercelOidcToken()
    const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`

    const stsRes = await fetch('https://sts.googleapis.com/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        audience,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        subject_token: oidcToken,
      }),
    })
    if (!stsRes.ok) {
      const err = await stsRes.text()
      throw new Error(`STS token exchange failed: ${stsRes.status} ${err.slice(0, 200)}`)
    }
    const stsData = await stsRes.json()

    const impRes = await fetch(
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stsData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scope: ['https://www.googleapis.com/auth/analytics.readonly'],
        }),
      },
    )
    if (!impRes.ok) {
      const err = await impRes.text()
      throw new Error(`SA impersonation failed: ${impRes.status} ${err.slice(0, 200)}`)
    }
    const impData = await impRes.json()
    return impData.accessToken
  }

  // (3) Application Default Credentials (로컬)
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/analytics.readonly'] })
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('Failed to get GA4 access token via ADC')
  return token
}

async function runReport<T = unknown>(body: object): Promise<T> {
  const token = await getAccessToken()
  const propertyId = getPropertyId()
  const res = await fetch(`${BASE_URL}/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GA4 API ${res.status}: ${text.slice(0, 500)}`)
  }
  return res.json() as Promise<T>
}

interface GA4RawResponse {
  rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }>
}

// ───── 공개 API ─────

export interface GA4Totals {
  sessions: number
  activeUsers: number
  newUsers: number
  conversions: number
  totalRevenue: number
  engagementRate: number
  averageSessionDuration: number
}

/** 기간 합계 - 사이트 전체 */
export async function getTotals(startDate: string, endDate: string): Promise<GA4Totals> {
  const json = await runReport<GA4RawResponse>({
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'sessions' }, { name: 'activeUsers' }, { name: 'newUsers' },
      { name: 'conversions' }, { name: 'totalRevenue' },
      { name: 'engagementRate' }, { name: 'averageSessionDuration' },
    ],
  })
  const v = json.rows?.[0]?.metricValues ?? []
  return {
    sessions: Number(v[0]?.value ?? 0),
    activeUsers: Number(v[1]?.value ?? 0),
    newUsers: Number(v[2]?.value ?? 0),
    conversions: Number(v[3]?.value ?? 0),
    totalRevenue: Number(v[4]?.value ?? 0),
    engagementRate: Number(v[5]?.value ?? 0),
    averageSessionDuration: Number(v[6]?.value ?? 0),
  }
}

export interface GA4DailyRow {
  date: string            // YYYY-MM-DD
  sessions: number
  activeUsers: number
  conversions: number
}

/** 일자별 추이 */
export async function getDaily(startDate: string, endDate: string): Promise<GA4DailyRow[]> {
  const json = await runReport<GA4RawResponse>({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'conversions' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 1000,
  })
  return (json.rows ?? []).map((r) => ({
    date: formatGa4Date(r.dimensionValues[0].value),
    sessions: Number(r.metricValues[0].value),
    activeUsers: Number(r.metricValues[1].value),
    conversions: Number(r.metricValues[2].value),
  }))
}

export interface GA4ChannelRow {
  channel: string
  sessions: number
  activeUsers: number
  conversions: number
  totalRevenue: number
}

/** 세션 기본 채널 그룹별 */
export async function getByChannel(startDate: string, endDate: string): Promise<GA4ChannelRow[]> {
  const json = await runReport<GA4RawResponse>({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'conversions' }, { name: 'totalRevenue' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  })
  return (json.rows ?? []).map((r) => ({
    channel: r.dimensionValues[0].value || '(not set)',
    sessions: Number(r.metricValues[0].value),
    activeUsers: Number(r.metricValues[1].value),
    conversions: Number(r.metricValues[2].value),
    totalRevenue: Number(r.metricValues[3].value),
  }))
}

export interface GA4SourceRow {
  source: string
  medium: string
  campaign: string
  sessions: number
  conversions: number
}

/** 트래픽 소스 / 매체 / 캠페인 */
export async function getBySource(startDate: string, endDate: string): Promise<GA4SourceRow[]> {
  const json = await runReport<GA4RawResponse>({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'sessionCampaignName' }],
    metrics: [{ name: 'sessions' }, { name: 'conversions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 30,
  })
  return (json.rows ?? []).map((r) => ({
    source: r.dimensionValues[0].value || '(direct)',
    medium: r.dimensionValues[1].value || '(none)',
    campaign: r.dimensionValues[2].value || '(not set)',
    sessions: Number(r.metricValues[0].value),
    conversions: Number(r.metricValues[1].value),
  }))
}

// ═════════════════════════════════════════════════════════════════════
// 이벤트 (랜딩 페이지) 스코프 조회
// pagePath 차원 필터로 특정 이벤트 랜딩 페이지의 데이터만 추출
// ═════════════════════════════════════════════════════════════════════

export interface GA4PageTotals extends GA4Totals {
  screenPageViews: number
}

/**
 * 이벤트 단위 GA4 dimension 필터 빌더.
 *
 * 실제 heypick 랜딩 URL 구조:
 *   heypick.co.kr/tasks/<templateId>/?event=<eventId>&media=<mediaId>
 * → 이벤트 ID 는 URL 쿼리스트링에 존재, pagePath 엔 없음.
 * 따라서 `pagePathPlusQueryString CONTAINS 'event=<id>'` 로 매칭해야 정확.
 *
 * 레거시 슬러그 페이지 (쿼리 파라미터 없는 구조 이전 URL) 는 추가 OR 로 pagePath BEGINS_WITH 매칭.
 *
 * @param eventQueryParam - 예: "event=1042"
 * @param legacyPathPrefixes - 예: ["/nexentire_rental"]
 * @param excludeTest - Headless 브라우저 제외
 */
function eventDimensionFilter(
  eventQueryParam: string,
  legacyPathPrefixes: string[],
  excludeTest?: boolean,
) {
  const matchExpressions: unknown[] = [
    {
      filter: {
        fieldName: 'pagePathPlusQueryString',
        stringFilter: { matchType: 'CONTAINS' as const, value: eventQueryParam },
      },
    },
    ...legacyPathPrefixes.map((p) => ({
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'BEGINS_WITH' as const, value: p },
      },
    })),
  ]

  const matchGroup = matchExpressions.length === 1
    ? matchExpressions[0]
    : { orGroup: { expressions: matchExpressions } }

  if (!excludeTest) return { dimensionFilter: matchGroup }

  return {
    dimensionFilter: {
      andGroup: {
        expressions: [
          matchGroup,
          {
            notExpression: {
              filter: {
                fieldName: 'browser',
                stringFilter: { matchType: 'CONTAINS' as const, value: 'Headless' },
              },
            },
          },
        ],
      },
    },
  }
}

/** 이벤트 랜딩 페이지 합계 (screenPageViews 포함) */
export async function getEventTotals(
  startDate: string,
  endDate: string,
  eventQueryParam: string,
  legacyPathPrefixes: string[],
  excludeTest?: boolean,
): Promise<GA4PageTotals> {
  const json = await runReport<GA4RawResponse>({
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'sessions' }, { name: 'activeUsers' }, { name: 'newUsers' },
      { name: 'conversions' }, { name: 'totalRevenue' },
      { name: 'engagementRate' }, { name: 'averageSessionDuration' },
    ],
    ...eventDimensionFilter(eventQueryParam, legacyPathPrefixes, excludeTest),
  })
  const v = json.rows?.[0]?.metricValues ?? []
  return {
    screenPageViews: Number(v[0]?.value ?? 0),
    sessions: Number(v[1]?.value ?? 0),
    activeUsers: Number(v[2]?.value ?? 0),
    newUsers: Number(v[3]?.value ?? 0),
    conversions: Number(v[4]?.value ?? 0),
    totalRevenue: Number(v[5]?.value ?? 0),
    engagementRate: Number(v[6]?.value ?? 0),
    averageSessionDuration: Number(v[7]?.value ?? 0),
  }
}

/** 이벤트 랜딩 일자별 추이 */
export async function getEventDaily(
  startDate: string,
  endDate: string,
  eventQueryParam: string,
  legacyPathPrefixes: string[],
  excludeTest?: boolean,
): Promise<GA4DailyRow[]> {
  const json = await runReport<GA4RawResponse>({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'conversions' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
    limit: 1000,
    ...eventDimensionFilter(eventQueryParam, legacyPathPrefixes, excludeTest),
  })
  return (json.rows ?? []).map((r) => ({
    date: formatGa4Date(r.dimensionValues[0].value),
    sessions: Number(r.metricValues[0].value),
    activeUsers: Number(r.metricValues[1].value),
    conversions: Number(r.metricValues[2].value),
  }))
}

/** 이벤트 랜딩 소스/매체/캠페인별 */
export async function getEventBySource(
  startDate: string,
  endDate: string,
  eventQueryParam: string,
  legacyPathPrefixes: string[],
  excludeTest?: boolean,
): Promise<GA4SourceRow[]> {
  const json = await runReport<GA4RawResponse>({
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionCampaignName' },
    ],
    metrics: [{ name: 'sessions' }, { name: 'conversions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 50,
    ...eventDimensionFilter(eventQueryParam, legacyPathPrefixes, excludeTest),
  })
  return (json.rows ?? []).map((r) => ({
    source: r.dimensionValues[0].value || '(direct)',
    medium: r.dimensionValues[1].value || '(none)',
    campaign: r.dimensionValues[2].value || '(not set)',
    sessions: Number(r.metricValues[0].value),
    conversions: Number(r.metricValues[1].value),
  }))
}

// ═════════════════════════════════════════════════════════════════════

export async function healthCheck(): Promise<{ ok: boolean; error?: string; credsPresent: boolean; sessionsToday?: number }> {
  const credsPresent = hasGA4Creds()
  if (!credsPresent) return { ok: false, credsPresent, error: 'GA4 credentials not set (GA4_PROPERTY_ID + auth)' }
  try {
    const today = new Date().toISOString().slice(0, 10)
    const totals = await getTotals(today, today)
    return { ok: true, credsPresent, sessionsToday: totals.sessions }
  } catch (e) {
    return { ok: false, credsPresent, error: (e as Error).message }
  }
}

function formatGa4Date(yyyymmdd: string): string {
  // "20260417" -> "2026-04-17"
  if (yyyymmdd.length === 8) {
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
  }
  return yyyymmdd
}
