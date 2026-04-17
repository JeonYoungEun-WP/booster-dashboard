/**
 * 네이버 검색광고 API 클라이언트
 *
 * 공식 문서: https://naver.github.io/searchad-apidoc/
 * 발급: https://searchad.naver.com → 도구 → API 관리자
 *
 * 필요 환경변수:
 * - NAVER_SEARCHAD_CUSTOMER_ID  (광고주 고객번호, 7자리)
 * - NAVER_SEARCHAD_API_KEY      (Access License)
 * - NAVER_SEARCHAD_SECRET_KEY   (Secret Key)
 *
 * 인증: HMAC-SHA256(secretKey, `{timestamp}.{method}.{uri}`) → base64
 * 요청 헤더:
 *   - X-Timestamp: unix millisec
 *   - X-API-KEY: api key
 *   - X-Customer: customer id
 *   - X-Signature: HMAC 서명
 *
 * ⚠️ 허가 IP(222.109.27.119)에서만 호출할 것.
 */

import crypto from 'node:crypto'
import { canCallMediaApi } from '../ip-guard'

const BASE_URL = 'https://api.searchad.naver.com'

function sign(timestamp: string, method: string, uri: string, secretKey: string): string {
  const msg = `${timestamp}.${method.toUpperCase()}.${uri}`
  return crypto.createHmac('sha256', secretKey).update(msg).digest('base64')
}

function getCreds() {
  const customerId = process.env.NAVER_SEARCHAD_CUSTOMER_ID
  const apiKey = process.env.NAVER_SEARCHAD_API_KEY
  const secretKey = process.env.NAVER_SEARCHAD_SECRET_KEY
  if (!customerId || !apiKey || !secretKey) {
    throw new Error('Naver Search Ad credentials missing: NAVER_SEARCHAD_CUSTOMER_ID / NAVER_SEARCHAD_API_KEY / NAVER_SEARCHAD_SECRET_KEY')
  }
  return { customerId, apiKey, secretKey }
}

async function call<T>(method: 'GET' | 'POST', uri: string, body?: unknown): Promise<T> {
  if (!canCallMediaApi()) {
    throw new Error('Naver Search Ad API call blocked: not in allowed IP (222.109.27.119)')
  }
  const { customerId, apiKey, secretKey } = getCreds()
  const timestamp = Date.now().toString()
  const signature = sign(timestamp, method, uri, secretKey)

  const res = await fetch(`${BASE_URL}${uri}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-API-KEY': apiKey,
      'X-Customer': customerId,
      'X-Signature': signature,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Naver Search Ad API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ───── API 메서드들 ─────

export interface NaverCampaign {
  nccCampaignId: string
  name: string
  campaignTp: string        // WEB_SITE, SHOPPING, POWER_CONTENTS, BRAND_SEARCH 등
  status: string            // ELIGIBLE, PAUSED, DELETED 등
  dailyBudget: number
  useDailyBudget: boolean
  deliveryMethod: string
  periodStartDt?: string
  periodEndDt?: string
}

export async function listCampaigns(): Promise<NaverCampaign[]> {
  return call<NaverCampaign[]>('GET', '/ncc/campaigns')
}

export interface NaverStatReport {
  id: string
  clkCnt: number
  impCnt: number
  salesAmt: number          // 비용 (원)
  ccnt: number              // 전환
  convAmt: number           // 전환금액
  ctr: number
  cpc: number
  avgRnk: number            // 평균순위
}

/**
 * 캠페인/그룹/키워드별 통계 조회
 * @param ids 대상 id 목록 (예: nccCampaignId 배열)
 * @param statTp CAMPAIGN | ADGROUP | KEYWORD | AD | AD_EXTENSION
 * @param datePreset LAST_7_DAYS | LAST_30_DAYS 등 또는 timeRange 로 대체
 */
export async function getStatReport(
  ids: string[],
  statTp: 'CAMPAIGN' | 'ADGROUP' | 'KEYWORD' | 'AD',
  startDate: string,
  endDate: string,
): Promise<NaverStatReport[]> {
  const uri = `/stats?ids=${ids.join(',')}&fields=%5B%22clkCnt%22%2C%22impCnt%22%2C%22salesAmt%22%2C%22ccnt%22%2C%22convAmt%22%2C%22ctr%22%2C%22cpc%22%2C%22avgRnk%22%5D&timeRange=%7B%22since%22%3A%22${startDate}%22%2C%22until%22%3A%22${endDate}%22%7D&datePreset=&breakdown=&statType=${statTp}`
  return call<NaverStatReport[]>('GET', uri)
}

/** 연결 상태 확인 (credentials 유효 + IP 매치 여부) */
export async function healthCheck(): Promise<{ ok: boolean; error?: string; campaignCount?: number }> {
  try {
    if (!canCallMediaApi()) return { ok: false, error: 'IP not allowed (222.109.27.119 required)' }
    const campaigns = await listCampaigns()
    return { ok: true, campaignCount: campaigns.length }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
