/**
 * GA4 페이지 진단 엔드포인트
 *
 * 특정 pagePath 접두 에 해당하는 URL 들의 pagePathPlusQueryString 원본값 조회.
 * 쿼리 파라미터가 GA4 에 보존되는지 진단하는 용도.
 *
 * GET /api/ga4/page-debug
 *   ?pathPrefix=/tasks/8426           (필수)
 *   &startDate=2026-03-01              (옵션, 기본: 30일 전)
 *   &endDate=2026-03-31                (옵션, 기본: 오늘)
 *
 * 응답:
 *   rows: Array<{ pagePathPlusQueryString, pageLocation, sessions, screenPageViews }>
 *   hasQueryStrings: boolean   (path 에 '?' 가 포함된 row 가 하나라도 있는지)
 */

import { NextRequest, NextResponse } from 'next/server'
import { hasGA4Creds } from '@/src/lib/channels/ga4'
import { GoogleAuth } from 'google-auth-library'
import { getVercelOidcToken } from '@vercel/functions/oidc'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

async function getAccessToken(): Promise<string> {
  const keyJson = process.env.GCP_SA_KEY_JSON
  if (keyJson) {
    const auth = new GoogleAuth({
      credentials: JSON.parse(keyJson),
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
    const client = await auth.getClient()
    const { token } = await client.getAccessToken()
    if (!token) throw new Error('no token from SA')
    return token
  }

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
    if (!stsRes.ok) throw new Error(`STS: ${stsRes.status}`)
    const stsData = await stsRes.json()
    const impRes = await fetch(
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${stsData.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/analytics.readonly'] }),
      },
    )
    if (!impRes.ok) throw new Error(`Impersonation: ${impRes.status}`)
    const impData = await impRes.json()
    return impData.accessToken
  }

  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/analytics.readonly'] })
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('no ADC token')
  return token
}

function offsetDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  if (!hasGA4Creds()) {
    return NextResponse.json({ error: 'GA4 creds not configured' }, { status: 503 })
  }
  const { searchParams } = new URL(req.url)
  const pathPrefix = searchParams.get('pathPrefix')
  if (!pathPrefix) {
    return NextResponse.json({ error: 'pathPrefix required (e.g., /tasks/8426)' }, { status: 400 })
  }
  const startDate = searchParams.get('startDate') || offsetDate(30)
  const endDate = searchParams.get('endDate') || offsetDate(0)

  const propertyId = process.env.GA4_PROPERTY_ID!.trim()
  const prop = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`

  try {
    const token = await getAccessToken()
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${prop}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'pagePathPlusQueryString' },
          { name: 'pageLocation' },
        ],
        metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: { matchType: 'BEGINS_WITH', value: pathPrefix },
          },
        },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 100,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `GA4 ${res.status}: ${text.slice(0, 500)}` }, { status: 500 })
    }
    const json = await res.json() as {
      rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }>
      rowCount?: number
    }

    const rows = (json.rows ?? []).map((r) => ({
      pagePathPlusQueryString: r.dimensionValues[0]?.value ?? '',
      pageLocation: r.dimensionValues[1]?.value ?? '',
      sessions: Number(r.metricValues[0]?.value ?? 0),
      screenPageViews: Number(r.metricValues[1]?.value ?? 0),
    }))

    const hasQueryStrings = rows.some((r) => r.pagePathPlusQueryString.includes('?'))
    const anyEventParam = rows.some((r) => /[?&]event=/.test(r.pagePathPlusQueryString))

    const totalSessions = rows.reduce((s, r) => s + r.sessions, 0)
    const totalPageViews = rows.reduce((s, r) => s + r.screenPageViews, 0)

    return NextResponse.json({
      pathPrefix,
      period: { startDate, endDate },
      rowCount: json.rowCount,
      totalSessions,
      totalPageViews,
      hasQueryStrings,
      anyEventParam,
      note: hasQueryStrings
        ? (anyEventParam
            ? '✅ 쿼리 파라미터 보존됨 + event=* 존재 — 정상 필터링 가능'
            : '⚠️ 쿼리는 보존되지만 event= 파라미터 없음 — 사이트 측 URL 확인 필요')
        : '⚠️ 쿼리 파라미터 모두 제거됨 — GA4 데이터 스트림 "제거할 쿼리 매개변수" 설정에 event/media 가 포함된 듯. 템플릿 경로 BEGINS_WITH 매칭으로 우회 필요.',
      rows: rows.slice(0, 30),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
