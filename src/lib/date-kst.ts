/**
 * Asia/Seoul(KST) 기준 날짜 유틸
 *
 * ⚠️ 왜 필요한가:
 *   서버는 Vercel(UTC)에서 실행된다. `new Date().toISOString().slice(0, 10)` 는
 *   UTC 기준 날짜를 반환하므로, KST 00:00~09:00 (UTC 15:00~24:00) 사이에는
 *   "오늘" 이 하루 밀려(어제로) 계산된다.
 *   예) KST 2026-07-07 02:00 == UTC 2026-07-06 17:00 → toISOString() 은 "2026-07-06".
 *
 *   따라서 "오늘" · "N일 전" 같은 상대 날짜는 반드시 타임존을 명시(Asia/Seoul)해
 *   계산해야 한다. Intl.DateTimeFormat('en-CA') 는 'YYYY-MM-DD' 포맷을 그대로 뱉어
 *   슬라이싱 없이 안전하다.
 */

// en-CA 로케일은 'YYYY-MM-DD' 형식을 반환 → 별도 파싱 불필요
const KST_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Asia/Seoul 기준 오늘 (YYYY-MM-DD) */
export function todayKST(): string {
  return KST_FORMATTER.format(new Date())
}

/**
 * KST 기준 N일 전 (YYYY-MM-DD).
 * @param daysAgo 0 = 오늘, 1 = 어제, 7 = 7일 전 …
 *
 * 24h(밀리초) 를 빼는 방식은 서머타임이 없는 한국(KST 고정 +09:00)에서 안전하다.
 */
export function offsetDateKST(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  return KST_FORMATTER.format(d)
}
