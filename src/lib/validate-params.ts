/**
 * API 입력 파라미터 검증 (zod 기반)
 *
 * ⚠️ 왜 필요한가:
 *   API 라우트들이 startDate/endDate/eventId/legacySlug 를 무검증 통과시키면
 *   `?startDate=0001-01-01&endDate=9999-12-31` 같은 요청이 수백만 요소 배열을
 *   생성해(dateRange 루프) 서버리스 함수 리소스를 소진시키는 DoS(무인증)가 가능하다.
 *
 *   → 날짜는 형식·순서·최대 기간(366일)을 검증하고, ID/슬러그는 화이트리스트
 *     정규식으로 좁힌다. 검증 실패 시 호출자가 400 을 반환할 수 있게
 *     `{ ok: false, error }` 형태로 리턴한다.
 */

import { z } from 'zod'

/** 최대 허용 기간 (일). 이 값을 넘으면 endDate 기준으로 클램프한다. */
const MAX_RANGE_DAYS = 366

/** 이벤트 ID — 숫자 1~10자리 */
export const eventIdSchema = z.string().regex(/^\d{1,10}$/, 'eventId 형식이 올바르지 않습니다 (숫자 1~10자리)')

/** 레거시 슬러그 — 영숫자·하이픈·언더스코어 1~50자 */
export const legacySlugSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/, 'legacySlug 형식이 올바르지 않습니다')

/** 날짜 문자열 — YYYY-MM-DD */
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 여야 합니다')

export type ValidationResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

export interface DateRange {
  startDate: string | null
  endDate: string | null
  /** 366일 초과로 endDate 기준 366일로 잘렸는지 여부 */
  clamped: boolean
}

/** UTC 자정 기준 두 날짜 사이 일수 차이 (end - start). */
function diffDays(start: string, end: string): number {
  const s = Date.parse(`${start}T00:00:00Z`)
  const e = Date.parse(`${end}T00:00:00Z`)
  return Math.round((e - s) / 86_400_000)
}

/** endDate 에서 (days) 일 전 날짜 (YYYY-MM-DD, UTC 기준 계산). */
function subtractDays(dateStr: string, days: number): string {
  const t = Date.parse(`${dateStr}T00:00:00Z`) - days * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/**
 * startDate/endDate 검증.
 *  - YYYY-MM-DD 형식 검증
 *  - 실제 유효한 날짜인지 (예: 2026-13-40 거부)
 *  - 시작 ≤ 종료
 *  - 기간이 366일 초과면 에러가 아니라 endDate 기준 366일로 클램프하고 clamped: true 반환
 *  - 둘 다 미지정 시 { startDate: null, endDate: null } 통과 (기본 기간은 호출부가 결정)
 *  - 한쪽만 지정 시엔 지정된 쪽만 검증하고 나머지는 null (기간 클램프는 양쪽 다 있을 때만)
 */
export function parseDateRange(
  startDate?: string | null,
  endDate?: string | null,
): ValidationResult<DateRange> {
  const rawStart = startDate ?? null
  const rawEnd = endDate ?? null

  // 미지정 → null 통과
  if (rawStart === null && rawEnd === null) {
    return { ok: true, startDate: null, endDate: null, clamped: false }
  }

  // 형식 검증
  for (const [name, value] of [['startDate', rawStart], ['endDate', rawEnd]] as const) {
    if (value !== null) {
      const parsed = dateStringSchema.safeParse(value)
      if (!parsed.success) {
        return { ok: false, error: `${name}: ${parsed.error.issues[0]?.message ?? '유효하지 않은 날짜'}` }
      }
      // 실제 캘린더상 유효 날짜인지 (2026-02-30 등 거부)
      const ts = Date.parse(`${value}T00:00:00Z`)
      if (Number.isNaN(ts) || new Date(ts).toISOString().slice(0, 10) !== value) {
        return { ok: false, error: `${name}: 존재하지 않는 날짜입니다 (${value})` }
      }
    }
  }

  // 한쪽만 지정된 경우 — 클램프 불필요, 그대로 통과
  if (rawStart === null || rawEnd === null) {
    return { ok: true, startDate: rawStart, endDate: rawEnd, clamped: false }
  }

  // 시작 ≤ 종료
  if (rawStart > rawEnd) {
    return { ok: false, error: `startDate(${rawStart}) 가 endDate(${rawEnd}) 보다 이후입니다` }
  }

  // 최대 기간 클램프 — 366일 초과 시 endDate 기준으로 잘라냄 (에러 대신)
  const span = diffDays(rawStart, rawEnd)
  if (span > MAX_RANGE_DAYS) {
    return {
      ok: true,
      startDate: subtractDays(rawEnd, MAX_RANGE_DAYS),
      endDate: rawEnd,
      clamped: true,
    }
  }

  return { ok: true, startDate: rawStart, endDate: rawEnd, clamped: false }
}

/** eventId 검증 헬퍼 — 실패 시 { ok:false, error } */
export function parseEventId(value?: string | null): ValidationResult<{ eventId: string }> {
  const parsed = eventIdSchema.safeParse(value ?? '')
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'eventId 가 유효하지 않습니다' }
  }
  return { ok: true, eventId: parsed.data }
}

/** legacySlug 검증 헬퍼 (선택값 — 미지정 시 null 통과) */
export function parseLegacySlug(value?: string | null): ValidationResult<{ legacySlug: string | null }> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, legacySlug: null }
  }
  const parsed = legacySlugSchema.safeParse(value)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'legacySlug 가 유효하지 않습니다' }
  }
  return { ok: true, legacySlug: parsed.data }
}
