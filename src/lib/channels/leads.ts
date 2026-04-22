/**
 * 리드 · 예약 어댑터 (Phase 1: 결정론적 더미 데이터)
 *
 * 사용자 결정: 리드 DB / 상담 결과 DB 는 Phase 1 에서 더미로 구현.
 * Phase 2 에서 이 함수 본문만 실제 DB/API 쿼리로 교체하면 호출부 수정 없음.
 *
 * 리드 → 예약 분포 (시뮬레이션 기준):
 *   - 세션 수 × (5~10%) = 리드 수
 *   - 리드 중:
 *       접수 20%, 통화중 15%, 예약완료 35%, 거절 15%, 무응답 15%
 *   - 트래킹코드 분포: 광고 캠페인의 비중과 정합되게 생성
 */

import { parseCampaignTag } from '../mapping'

export type LeadStatus = '접수' | '통화중' | '예약완료' | '거절' | '무응답'

export interface LeadRow {
  id: string
  eventId: string
  trackingCode: string
  phone: string              // 마스킹 처리된 전화번호 (더미)
  name: string               // 더미 이름 (한 글자 + *)
  status: LeadStatus
  source: string             // 매체 (google/meta/naver/...) 추정
  createdAt: string          // ISO datetime
  reservedAt?: string        // status === '예약완료' 시 실제 예약 확정 시간
}

export interface ReservationStats {
  leadCount: number
  reservationCount: number
  byStatus: Array<{ status: LeadStatus; count: number }>
  byTrackingCode: Array<{ trackingCode: string; leads: number; reservations: number }>
  byDate: Array<{ date: string; leads: number; reservations: number }>
}

// Phase 1 은 항상 true (더미 데이터 사용)
export function hasLeadCreds(): boolean {
  return true
}

/** 이 구현은 더미인지 여부 — UI 배너 표시용 */
export function isLeadDataSimulated(): boolean {
  return !process.env.LEADS_DATABASE_URL
}

// ───── 시드·난수 유틸 ─────

function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function rand(seed: number, min: number, max: number): number {
  return min + seed * (max - min)
}

function dateRange(startDate: string, endDate: string): string[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const dates: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// ───── 더미 생성 파라미터 ─────

const STATUS_DIST: Array<{ status: LeadStatus; weight: number }> = [
  { status: '접수',     weight: 0.20 },
  { status: '통화중',   weight: 0.15 },
  { status: '예약완료', weight: 0.35 },
  { status: '거절',     weight: 0.15 },
  { status: '무응답',   weight: 0.15 },
]

const SOURCE_POOL = ['google', 'meta', 'naver', 'kakao', 'tiktok', 'karrot', '(direct)']

/** 시드 기반 상태 할당 */
function pickStatus(seed: number): LeadStatus {
  let acc = 0
  for (const { status, weight } of STATUS_DIST) {
    acc += weight
    if (seed < acc) return status
  }
  return '접수'
}

/** 이벤트 ID 당 대략적인 트래킹코드 목록 (모의) */
function generateTrackingCodes(eventId: string, count: number = 5): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const s = seedFromString(`tc-${eventId}-${i}`)
    const raw = Math.floor(s * 0xffffffff).toString(36).slice(0, 8)
    codes.push(raw.padEnd(8, 'x'))
  }
  return codes
}

/**
 * 세션 수(광고 시뮬레이션과 정합) 기반으로 리드를 생성.
 * sessionCount 가 주어지면 그 5~10% 를 리드로, 아니면 이벤트ID 기반 기본치.
 */
function dailyLeadCount(eventId: string, date: string, sessionCount?: number): number {
  if (sessionCount !== undefined) {
    const s = seedFromString(`lead-rate-${eventId}-${date}`)
    const rate = rand(s, 0.05, 0.10)   // 5~10%
    return Math.round(sessionCount * rate)
  }
  // 세션 수 힌트가 없으면 이벤트 기반 기본치
  const s = seedFromString(`lead-${eventId}-${date}`)
  return Math.round(rand(s, 5, 35))
}

// ───── 공개 API ─────

/**
 * 총량 `total` 을 주어진 날짜 배열에 **주말 가중치 10%** 로 분배.
 * - 주중(월~금): weight 1.0 + ±15% 시드 변동
 * - 주말(토·일): weight 0.1 + ±15% 시드 변동
 * - 합이 정확히 `total` 이 되도록 잔여 보정
 */
function distributeWithWeekendFactor(
  total: number,
  dates: string[],
  seedPrefix: string,
  weekendFactor: number = 0.1,
): Record<string, number> {
  if (total <= 0 || dates.length === 0) {
    return Object.fromEntries(dates.map((d) => [d, 0]))
  }
  const weights = dates.map((d) => {
    const day = new Date(d).getDay()            // 0=일, 6=토
    const base = (day === 0 || day === 6) ? weekendFactor : 1.0
    const variation = 0.85 + seedFromString(`${seedPrefix}-${d}`) * 0.30  // 0.85 ~ 1.15
    return base * variation
  })
  const totalWeight = weights.reduce((s, w) => s + w, 0)
  const floats = weights.map((w) => total * (w / totalWeight))
  const floors = floats.map(Math.floor)
  const sum = floors.reduce((s, n) => s + n, 0)
  const remainder = total - sum

  // 소수점 큰 날짜부터 +1 씩 분배
  const sortedIdx = dates
    .map((_, i) => i)
    .sort((a, b) => (floats[b] - floors[b]) - (floats[a] - floors[a]))

  const result: Record<string, number> = {}
  dates.forEach((d, i) => { result[d] = floors[i] })
  for (let i = 0; i < remainder && i < sortedIdx.length; i++) {
    const idx = sortedIdx[i]
    result[dates[idx]] += 1
  }
  return result
}

/**
 * 이벤트 ID (+ 옵션 트래킹코드) 로 기간 내 리드 목록 생성.
 *
 * @param eventId
 * @param trackingCode - 특정 광고세트로 좁히고 싶을 때
 * @param startDate ISO yyyy-mm-dd
 * @param endDate   ISO yyyy-mm-dd
 * @param sessionByDate - GA4 일별 세션 (있으면 정합성 있는 분포 생성)
 * @param candidateTrackingCodes - 실제 광고에 존재하는 트래킹코드 목록.
 *   주어지면 이 코드들로만 리드를 분배 (광고 ↔ 리드 ↔ 예약 조인 성립).
 *   없으면 이벤트ID 기반 더미 코드 생성 (조인 불가 경고).
 * @param overrideTotalLeads - 실데이터 제공 이벤트의 총 리드 건수 강제 지정.
 *   주어지면 주말 10% 가중치로 날짜별 분배 (합계 정확).
 * @param overrideTotalReservations - 예약 총 건수 강제 지정.
 *   주어지면 예약완료 상태를 N건만 할당 (주말 가중치 분배, 리드 집합 부분집합).
 * @param realTimestamps - 실제 리드 발생 타임스탬프 배열 ('YYYY-MM-DD HH:MM:SS' 형식).
 *   주어지면 overrideTotalLeads 대신 이 타임스탬프들을 그대로 사용 (가장 정확).
 */
export async function getLeadsByEvent(
  eventId: string,
  trackingCode?: string,
  startDate?: string,
  endDate?: string,
  sessionByDate?: Record<string, number>,
  candidateTrackingCodes?: string[],
  overrideTotalLeads?: number,
  overrideTotalReservations?: number,
  realTimestamps?: string[],
): Promise<LeadRow[]> {
  const start = startDate ?? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const end = endDate ?? new Date().toISOString().slice(0, 10)
  const dates = dateRange(start, end)

  const allCodes = (candidateTrackingCodes && candidateTrackingCodes.length > 0)
    ? candidateTrackingCodes
    : generateTrackingCodes(eventId, 5)
  const codes = trackingCode ? [trackingCode] : allCodes

  // realTimestamps 제공 시 날짜별 타임스탬프 그룹 (가장 우선)
  const timestampsByDate: Record<string, string[]> | null = realTimestamps && realTimestamps.length > 0
    ? (() => {
        const m: Record<string, string[]> = {}
        for (const ts of realTimestamps) {
          const d = ts.slice(0, 10)
          ;(m[d] ??= []).push(ts)
        }
        return m
      })()
    : null

  // overrideTotalLeads → 주말 가중치 분배 (realTimestamps 없을 때만)
  const overrideLeadsDaily: Record<string, number> = (!timestampsByDate && overrideTotalLeads !== undefined)
    ? distributeWithWeekendFactor(overrideTotalLeads, dates, `leads-${eventId}`)
    : {}

  // overrideTotalReservations → 날짜별 예약 건수 (주말 가중치)
  const overrideReservationsDaily: Record<string, number> = overrideTotalReservations !== undefined
    ? distributeWithWeekendFactor(overrideTotalReservations, dates, `res-${eventId}`)
    : {}

  const leads: LeadRow[] = []
  let idCounter = 0

  for (const date of dates) {
    const sessions = sessionByDate?.[date]
    const realTs = timestampsByDate?.[date] ?? []
    const count = timestampsByDate
      ? realTs.length
      : overrideTotalLeads !== undefined
        ? (overrideLeadsDaily[date] ?? 0)
        : dailyLeadCount(eventId, date, sessions)

    // 이 날짜에 '예약완료' 로 강제 할당할 리드 수 (override 모드에서만)
    const reservationsForDate = overrideTotalReservations !== undefined
      ? (overrideReservationsDaily[date] ?? 0)
      : -1

    for (let i = 0; i < count; i++) {
      const seedBase = `${eventId}-${date}-${i}`
      const sStatus = seedFromString(`status-${seedBase}`)
      const sCode = seedFromString(`code-${seedBase}`)
      const sSource = seedFromString(`source-${seedBase}`)
      const sPhone = seedFromString(`phone-${seedBase}`)
      const sName = seedFromString(`name-${seedBase}`)
      const sTime = seedFromString(`time-${seedBase}`)

      // 상태 할당:
      // - override 모드: 처음 reservationsForDate 건은 '예약완료',
      //   나머지는 시드 기반 4개 상태(접수·통화중·거절·무응답) 분배
      // - 기본 모드: 시드 기반 5개 상태 분배
      let status: LeadStatus
      if (reservationsForDate >= 0) {
        if (i < reservationsForDate) {
          status = '예약완료'
        } else {
          // 비-예약완료 4개 상태 (접수·통화중·거절·무응답) 에 균등 분배
          const nonReservation = ['접수', '통화중', '거절', '무응답'] as const
          status = nonReservation[Math.floor(sStatus * nonReservation.length)]
        }
      } else {
        status = pickStatus(sStatus)
      }
      const codeIdx = Math.floor(sCode * codes.length)
      const code = codes[Math.min(codeIdx, codes.length - 1)]
      const source = SOURCE_POOL[Math.floor(sSource * SOURCE_POOL.length)]

      // 전화번호 더미: 010-????-****
      const mid = String(Math.floor(sPhone * 10000)).padStart(4, '0')
      const phone = `010-${mid}-****`

      const NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임']
      const name = NAMES[Math.floor(sName * NAMES.length)] + '*'

      // createdAt: 실 타임스탬프 있으면 사용, 없으면 시드 기반 생성
      let createdAt: string
      const realTsForThisLead = realTs[i]
      if (realTsForThisLead) {
        // '2026-03-01 02:43:00' → '2026-03-01T02:43:00+09:00'
        createdAt = realTsForThisLead.replace(' ', 'T') + '+09:00'
      } else {
        const hour = Math.floor(sTime * 14) + 8      // 업무시간 8~22
        const minute = Math.floor((sTime * 13) % 60)
        createdAt = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`
      }

      const reservedAt = status === '예약완료'
        ? new Date(new Date(createdAt).getTime() + Math.floor(rand(sStatus, 1, 48)) * 3600_000).toISOString()
        : undefined

      leads.push({
        id: `${eventId}-${date}-${idCounter++}`,
        eventId,
        trackingCode: code,
        phone,
        name,
        status,
        source,
        createdAt,
        reservedAt,
      })
    }
  }

  return leads
}

/**
 * 이벤트 ID 기준 리드·예약 집계 통계.
 * API 라우트에서 한 번만 호출해서 테이블·카드에 동시 활용.
 */
export async function getReservationStats(
  eventId: string,
  trackingCode?: string,
  startDate?: string,
  endDate?: string,
  sessionByDate?: Record<string, number>,
  candidateTrackingCodes?: string[],
  overrideTotalLeads?: number,
  overrideTotalReservations?: number,
  realTimestamps?: string[],
): Promise<ReservationStats> {
  const leads = await getLeadsByEvent(
    eventId, trackingCode, startDate, endDate, sessionByDate, candidateTrackingCodes,
    overrideTotalLeads, overrideTotalReservations, realTimestamps,
  )

  const byStatusMap = new Map<LeadStatus, number>()
  for (const { status } of STATUS_DIST) byStatusMap.set(status, 0)
  for (const l of leads) byStatusMap.set(l.status, (byStatusMap.get(l.status) ?? 0) + 1)

  const byCodeMap = new Map<string, { leads: number; reservations: number }>()
  for (const l of leads) {
    const prev = byCodeMap.get(l.trackingCode) ?? { leads: 0, reservations: 0 }
    byCodeMap.set(l.trackingCode, {
      leads: prev.leads + 1,
      reservations: prev.reservations + (l.status === '예약완료' ? 1 : 0),
    })
  }

  const byDateMap = new Map<string, { leads: number; reservations: number }>()
  for (const l of leads) {
    const date = l.createdAt.slice(0, 10)
    const prev = byDateMap.get(date) ?? { leads: 0, reservations: 0 }
    byDateMap.set(date, {
      leads: prev.leads + 1,
      reservations: prev.reservations + (l.status === '예약완료' ? 1 : 0),
    })
  }

  const reservationCount = leads.filter((l) => l.status === '예약완료').length

  return {
    leadCount: leads.length,
    reservationCount,
    byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
    byTrackingCode: Array.from(byCodeMap.entries())
      .map(([trackingCode, v]) => ({ trackingCode, ...v }))
      .sort((a, b) => b.reservations - a.reservations),
    byDate: Array.from(byDateMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }
}

/** ad-data.ts 의 CampaignPerformance 목록을 받아 이벤트별 트래킹코드 사용 현황 추출 */
export function extractEventTrackingCodesFromCampaigns(
  campaigns: Array<{ campaignName: string }>,
  eventId: string,
): string[] {
  const codes = new Set<string>()
  for (const c of campaigns) {
    const tag = parseCampaignTag(c.campaignName)
    if (tag && tag.eventId === eventId) codes.add(tag.trackingCode)
  }
  return Array.from(codes)
}
