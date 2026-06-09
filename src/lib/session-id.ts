/**
 * 익명 세션 ID — 인증 없는 챗봇의 대화 소유권 식별.
 *
 * 브라우저 쿠키에 UUID 저장. 같은 브라우저·도메인에서는 1년간 유지.
 * Phase 5+ 에서 NextAuth 도입 시 sessionId → userId 마이그레이션 가능.
 */

const COOKIE_NAME = 'bm_chat_sid'
const ONE_YEAR_SEC = 60 * 60 * 24 * 365

function uuid(): string {
  // 브라우저·서버 모두에서 동작
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // fallback (Node.js 18- 또는 비표준 환경)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** 브라우저 환경 — 쿠키에서 sessionId 읽고, 없으면 발급. */
export function getOrCreateSessionIdClient(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`))
  if (match) return decodeURIComponent(match[1])
  const id = uuid()
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(id)}; path=/; max-age=${ONE_YEAR_SEC}; SameSite=Lax`
  return id
}

/** 서버 환경 — Next.js 라우트 핸들러에서 cookies() 받아 처리. */
export async function getSessionIdServer(): Promise<string | null> {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value ?? null
}

/** 서버에서 새 세션 ID 발급 (Set-Cookie 헤더 통해). */
export function buildSetCookieHeader(sessionId: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${ONE_YEAR_SEC}; SameSite=Lax; HttpOnly`
}

export const SESSION_COOKIE_NAME = COOKIE_NAME
export const SESSION_TTL_SEC = ONE_YEAR_SEC

/** UUID 생성 — 클라이언트·서버 공용. */
export function generateUUID(): string {
  return uuid()
}
