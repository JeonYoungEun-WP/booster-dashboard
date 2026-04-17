/**
 * 당근 (Karrot) 광고 연동
 *
 * ⚠️ 당근은 2026-04 현재 공개 광고 통계 API를 제공하지 않음.
 *    일반적 대안:
 *    1) 당근 비즈 광고 관리자에서 리포트 CSV 다운로드 → 이 라이브러리로 파싱
 *    2) 당근 파트너 API 자격이 있다면 ACCESS_TOKEN 을 환경변수로 주입
 *    3) 수동 입력 (소액 집행 시)
 *
 * 필요 환경변수 (파트너 API 사용 시):
 * - DANGGEUN_BIZ_API_BASE   (예: https://biz.daangn.com/api 등 — 파트너가 안내받은 주소)
 * - DANGGEUN_BIZ_ACCESS_TOKEN
 * - DANGGEUN_BIZ_ACCOUNT_ID
 *
 * CSV 파싱 사용 시 credentials 불필요.
 */

import { canCallMediaApi } from '../ip-guard'

export interface KarrotStatRow {
  date: string
  campaignName: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
}

function hasPartnerCreds(): boolean {
  return (
    !!process.env.DANGGEUN_BIZ_API_BASE &&
    !!process.env.DANGGEUN_BIZ_ACCESS_TOKEN &&
    !!process.env.DANGGEUN_BIZ_ACCOUNT_ID
  )
}

/**
 * 파트너 API로 통계 조회 (credentials 있을 때만)
 */
export async function getStatsViaPartnerApi(startDate: string, endDate: string): Promise<KarrotStatRow[]> {
  if (!canCallMediaApi()) {
    throw new Error('Karrot API call blocked: not in allowed IP (222.109.27.119)')
  }
  if (!hasPartnerCreds()) {
    throw new Error('Karrot partner API credentials missing (DANGGEUN_BIZ_API_BASE / DANGGEUN_BIZ_ACCESS_TOKEN / DANGGEUN_BIZ_ACCOUNT_ID)')
  }
  const base = process.env.DANGGEUN_BIZ_API_BASE!
  const token = process.env.DANGGEUN_BIZ_ACCESS_TOKEN!
  const accountId = process.env.DANGGEUN_BIZ_ACCOUNT_ID!

  const res = await fetch(`${base}/accounts/${accountId}/stats?from=${startDate}&to=${endDate}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Karrot API ${res.status}: ${text}`)
  }
  const json = await res.json()
  return (json.rows ?? []) as KarrotStatRow[]
}

/**
 * CSV 내용을 파싱 (당근 비즈 리포트 다운로드 파일 대응)
 * 기대 컬럼: 날짜, 캠페인명, 노출, 클릭, 비용, 전환
 */
export function parseCsvReport(csv: string): KarrotStatRow[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map((h) => h.replace(/^\ufeff/, '').trim())
  const col = (name: string) => header.indexOf(name)
  const idxDate = col('날짜')
  const idxCamp = col('캠페인명') >= 0 ? col('캠페인명') : col('캠페인')
  const idxImp = col('노출') >= 0 ? col('노출') : col('노출수')
  const idxClk = col('클릭') >= 0 ? col('클릭') : col('클릭수')
  const idxCost = col('비용') >= 0 ? col('비용') : col('광고비')
  const idxConv = col('전환') >= 0 ? col('전환') : col('전환수')

  return lines.slice(1).map((line) => {
    const cells = line.split(',')
    const num = (i: number) => (i >= 0 ? Number(cells[i]?.replace(/[",원]/g, '') || 0) : 0)
    return {
      date: idxDate >= 0 ? cells[idxDate]?.trim() : '',
      campaignName: idxCamp >= 0 ? cells[idxCamp]?.trim() : '',
      impressions: num(idxImp),
      clicks: num(idxClk),
      cost: num(idxCost),
      conversions: num(idxConv),
    }
  })
}

export async function healthCheck(): Promise<{ ok: boolean; mode: 'partner' | 'csv' | 'none'; error?: string }> {
  if (hasPartnerCreds()) {
    try {
      if (!canCallMediaApi()) return { ok: false, mode: 'partner', error: 'IP not allowed' }
      // 과거 1일치로 핑
      const today = new Date().toISOString().slice(0, 10)
      await getStatsViaPartnerApi(today, today)
      return { ok: true, mode: 'partner' }
    } catch (e) {
      return { ok: false, mode: 'partner', error: (e as Error).message }
    }
  }
  return { ok: false, mode: 'none', error: 'Karrot partner credentials not set. Use CSV import instead.' }
}
