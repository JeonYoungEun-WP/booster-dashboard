/**
 * 매체 API 접근 제어 (최우선 규칙 — CLAUDE.md 참조)
 *
 * 허가된 IP(사내 고정 IP)에서만 Meta / Google / Naver / TikTok / 당근 등 매체사 API에 접근할 수 있다.
 * 다른 환경(Vercel 서버리스 등)에서는 토큰이 화이트리스트되어 있지 않아 인증 실패 또는 계정 제재 위험이 있다.
 *
 * - 서버(Node) 환경에서 `process.env.SERVER_PUBLIC_IP` 를 허가된 IP로 설정했다면 이를 검사
 * - 요청 객체(Request)가 주어지면 `x-forwarded-for` 헤더에서 클라이언트 IP를 추출하여 대조
 *
 * Vercel의 경우 서버 자체 IP는 동적이므로 `SERVER_PUBLIC_IP` 는 평상시 매치되지 않는다.
 * 프로덕션에서는 사내 IP 장비에서 배치로 수집 → DB 적재 → 웹은 DB에서만 읽는 패턴을 권장.
 */

export const ALLOWED_MEDIA_API_IP = '222.109.27.119' as const

/** 서버 프로세스가 허가된 IP에서 실행 중인지 (환경변수 기반) */
export function isServerOnAllowedIp(): boolean {
  return process.env.SERVER_PUBLIC_IP === ALLOWED_MEDIA_API_IP
}

/** 요청의 클라이언트 IP가 허가된 IP인지 */
export function isRequestFromAllowedIp(req: Request): boolean {
  const xff = req.headers.get('x-forwarded-for')
  const real = req.headers.get('x-real-ip')
  const ip = (xff?.split(',')[0] || real || '').trim()
  return ip === ALLOWED_MEDIA_API_IP
}

/**
 * 매체 API를 실제로 호출해도 되는지 검사.
 * 어느 한쪽이라도 허가 IP이면 허용 (서버 자체 IP 또는 요청자 IP).
 * 가능한 한 엄격하게 서버 IP 기준으로만 허용하도록 운영하는 것이 안전.
 */
export function canCallMediaApi(req?: Request): boolean {
  if (isServerOnAllowedIp()) return true
  if (req && isRequestFromAllowedIp(req)) return true
  return false
}
