/**
 * TikTok for Business Ads API 클라이언트
 *
 * 공식 문서: https://business-api.tiktok.com/portal/docs
 * 개발자 포털: https://business-api.tiktok.com/
 *
 * 필요 환경변수:
 * - TIKTOK_ADS_ACCESS_TOKEN        (Long-lived access token, Business Center 에서 발급)
 * - TIKTOK_ADS_ADVERTISER_ID       (대상 광고주 ID, 숫자열)
 * - TIKTOK_ADS_APP_ID              (선택, OAuth 재발급용)
 * - TIKTOK_ADS_APP_SECRET          (선택, OAuth 재발급용)
 *
 * 인증: 요청 헤더 `Access-Token: <TOKEN>`, query param `advertiser_id`
 *
 * ⚠️ 허가 IP(222.109.27.119)에서만 호출할 것 (canCallMediaApi 가드 필수).
 */

import { canCallMediaApi } from '../ip-guard'

const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3'

function getCreds() {
  const token = process.env.TIKTOK_ADS_ACCESS_TOKEN
  const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID
  if (!token || !advertiserId) {
    throw new Error('TikTok Ads credentials missing: TIKTOK_ADS_ACCESS_TOKEN / TIKTOK_ADS_ADVERTISER_ID')
  }
  return { token, advertiserId }
}

function hasCreds(): boolean {
  return !!process.env.TIKTOK_ADS_ACCESS_TOKEN && !!process.env.TIKTOK_ADS_ADVERTISER_ID
}

async function call<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  if (!canCallMediaApi()) {
    throw new Error('TikTok Ads API call blocked: not in allowed IP (222.109.27.119)')
  }
  const { token, advertiserId } = getCreds()
  const qs = new URLSearchParams({ advertiser_id: advertiserId, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  const res = await fetch(`${BASE_URL}${path}?${qs}`, {
    headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`TikTok Ads API ${res.status}: ${text}`)
  }
  const json = await res.json() as { code: number; message: string; data: T }
  if (json.code !== 0) throw new Error(`TikTok Ads API error ${json.code}: ${json.message}`)
  return json.data
}

// ───── Types ─────

export interface TikTokCampaign {
  campaign_id: string
  campaign_name: string
  objective_type: string          // REACH / TRAFFIC / CONVERSIONS / APP_PROMOTION / VIDEO_VIEW 등
  status: string                  // ENABLE / DISABLE
  budget: number
  budget_mode: 'BUDGET_MODE_DAY' | 'BUDGET_MODE_TOTAL' | 'BUDGET_MODE_INFINITE'
}

export interface TikTokStatRow {
  campaign_id?: string
  adgroup_id?: string
  ad_id?: string
  stat_time_day?: string          // YYYY-MM-DD
  metrics: {
    spend: string                 // 문자열로 반환
    impressions: string
    clicks: string
    ctr: string
    cpc: string
    cpm: string
    conversion: string
    cost_per_conversion: string
    conversion_rate: string
    video_play_actions?: string
    video_watched_2s?: string
    video_watched_6s?: string
  }
}

// ───── API 메서드 ─────

/** 캠페인 목록 */
export async function listCampaigns(): Promise<TikTokCampaign[]> {
  const data = await call<{ list: TikTokCampaign[]; page_info: unknown }>('/campaign/get/', { page_size: 50 })
  return data.list
}

/**
 * 성과 리포트 (캠페인/광고그룹/광고 레벨)
 * level: AUCTION_CAMPAIGN | AUCTION_ADGROUP | AUCTION_AD
 */
export async function getReport(
  level: 'AUCTION_CAMPAIGN' | 'AUCTION_ADGROUP' | 'AUCTION_AD',
  startDate: string,
  endDate: string,
  dimensions: string[] = ['campaign_id', 'stat_time_day'],
  metrics: string[] = ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'conversion', 'cost_per_conversion', 'conversion_rate'],
): Promise<TikTokStatRow[]> {
  const data = await call<{ list: TikTokStatRow[] }>('/report/integrated/get/', {
    report_type: 'BASIC',
    data_level: level,
    start_date: startDate,
    end_date: endDate,
    dimensions: JSON.stringify(dimensions),
    metrics: JSON.stringify(metrics),
    page_size: 100,
  })
  return data.list
}

export async function healthCheck(): Promise<{ ok: boolean; error?: string; campaignCount?: number; credsPresent: boolean }> {
  const credsPresent = hasCreds()
  if (!credsPresent) return { ok: false, credsPresent, error: 'TikTok credentials not set' }
  try {
    if (!canCallMediaApi()) return { ok: false, credsPresent, error: 'IP not allowed (222.109.27.119 required)' }
    const campaigns = await listCampaigns()
    return { ok: true, credsPresent, campaignCount: campaigns.length }
  } catch (e) {
    return { ok: false, credsPresent, error: (e as Error).message }
  }
}
