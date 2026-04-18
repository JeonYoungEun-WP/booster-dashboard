/**
 * Google Analytics 4 (GA4) Data API 클라이언트
 *
 * 공식 문서: https://developers.google.com/analytics/devguides/reporting/data/v1
 * REST Base: https://analyticsdata.googleapis.com/v1beta
 *
 * ⚠️ GA4 는 매체 API가 아니므로 허가 IP 제약(222.109.27.119) 대상이 아님.
 *    단, Workload Identity / Service Account 을 Vercel 에 안전히 세팅할 것.
 *
 * 인증 옵션:
 *   (A) 서비스 계정 JSON (GOOGLE_APPLICATION_CREDENTIALS 또는 개별 필드)
 *   (B) Workload Identity Federation (GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID 등)
 *        — Vercel 에서 @vercel/oidc 토큰으로 GCP STS 교환 후 사용
 *
 * 필요 환경변수:
 * - GA4_PROPERTY_ID                (예: "properties/123456789")
 * - 인증 방식 (A): GA4_SERVICE_ACCOUNT_KEY (JSON 문자열)
 * - 인증 방식 (B): GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID, GCP_SERVICE_ACCOUNT_EMAIL
 */

const BASE_URL = 'https://analyticsdata.googleapis.com/v1beta'

function getPropertyId(): string {
  const id = process.env.GA4_PROPERTY_ID
  if (!id) throw new Error('GA4_PROPERTY_ID missing')
  return id.startsWith('properties/') ? id : `properties/${id}`
}

function hasCreds(): boolean {
  return !!process.env.GA4_PROPERTY_ID && (
    !!process.env.GA4_SERVICE_ACCOUNT_KEY ||
    (!!process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID && !!process.env.GCP_SERVICE_ACCOUNT_EMAIL)
  )
}

/**
 * 액세스 토큰 획득 (실 구현 TODO)
 *   - 서비스 계정 방식: google-auth-library `JWT.authorize()`
 *   - Workload Identity 방식: @vercel/oidc 으로 OIDC 토큰 → STS 교환
 */
async function getAccessToken(): Promise<string> {
  // TODO: 실 인증 로직 — 지금은 시뮬 전용
  throw new Error('GA4 real auth not implemented yet. Set GA4_SERVICE_ACCOUNT_KEY or Workload Identity env vars and implement this method.')
}

export interface GA4ChannelRow {
  date: string                    // YYYYMMDD
  sessionDefaultChannelGroup: string
  sessions: number
  activeUsers: number
  conversions: number
  totalRevenue: number
  engagementRate: number
}

/**
 * 일자 × 채널 그룹별 세션/전환/매출
 */
export async function runChannelReport(startDate: string, endDate: string): Promise<GA4ChannelRow[]> {
  if (!hasCreds()) throw new Error('GA4 credentials not set')
  const token = await getAccessToken()
  const propertyId = getPropertyId()
  const body = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'conversions' },
      { name: 'totalRevenue' },
      { name: 'engagementRate' },
    ],
    limit: 10000,
  }
  const res = await fetch(`${BASE_URL}/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GA4 API ${res.status}: ${text}`)
  }
  interface GA4Response { rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }> }
  const json = await res.json() as GA4Response
  return (json.rows ?? []).map((r) => ({
    date: r.dimensionValues[0].value,
    sessionDefaultChannelGroup: r.dimensionValues[1].value,
    sessions: Number(r.metricValues[0].value),
    activeUsers: Number(r.metricValues[1].value),
    conversions: Number(r.metricValues[2].value),
    totalRevenue: Number(r.metricValues[3].value),
    engagementRate: Number(r.metricValues[4].value),
  }))
}

/**
 * UTM 매체(source/medium/campaign) 별 리포트 — 광고 채널과 조인용
 */
export async function runUtmReport(startDate: string, endDate: string) {
  if (!hasCreds()) throw new Error('GA4 credentials not set')
  const token = await getAccessToken()
  const propertyId = getPropertyId()
  const body = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'sessionCampaignName' }],
    metrics: [{ name: 'sessions' }, { name: 'conversions' }, { name: 'totalRevenue' }],
    limit: 5000,
  }
  const res = await fetch(`${BASE_URL}/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GA4 API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function healthCheck(): Promise<{ ok: boolean; error?: string; credsPresent: boolean }> {
  const credsPresent = hasCreds()
  if (!credsPresent) return { ok: false, credsPresent, error: 'GA4 credentials not set (GA4_PROPERTY_ID + auth)' }
  try {
    const today = new Date().toISOString().slice(0, 10)
    await runChannelReport(today, today)
    return { ok: true, credsPresent }
  } catch (e) {
    return { ok: false, credsPresent, error: (e as Error).message }
  }
}
