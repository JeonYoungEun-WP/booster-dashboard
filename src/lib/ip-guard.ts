/**
 * 매체 API 접근 제어 (최우선 규칙 — CLAUDE.md 참조)
 *
 * 허가된 IP(사내 고정 IP)에서만 Meta / Google / Naver / TikTok / 당근 등 매체사 API에 접근할 수 있다.
 * 다른 환경(Vercel 서버리스 등)에서는 토큰이 화이트리스트되어 있지 않아 인증 실패 또는 계정 제재 위험이 있다.
 *
 * - 서버(Node) 환경에서 `process.env.SERVER_PUBLIC_IP` 를 허가된 IP로 설정했을 때만 검사 통과.
 * - `x-forwarded-for` / `x-real-ip` 등 요청 헤더는 클라이언트가 위조 가능하므로 절대 신뢰하지 않는다.
 *
 * Vercel의 경우 서버 자체 IP는 동적이므로 `SERVER_PUBLIC_IP` 는 평상시 매치되지 않는다.
 * 프로덕션에서는 사내 IP 장비에서 배치로 수집 → DB 적재 → 웹은 DB에서만 읽는 패턴을 권장.
 */

export const ALLOWED_MEDIA_API_IP = '222.109.27.119' as const

/** 서버 프로세스가 허가된 IP에서 실행 중인지 (환경변수 기반) */
export function isServerOnAllowedIp(): boolean {
  return process.env.SERVER_PUBLIC_IP === ALLOWED_MEDIA_API_IP
}

/**
 * 매체 API를 실제로 호출해도 되는지 검사.
 * 서버 자체 IP(환경변수) 단일 기준으로만 판정한다.
 * 위조 가능한 요청 헤더는 신뢰하지 않는다.
 */
export function canCallMediaApi(): boolean {
  return isServerOnAllowedIp()
}
