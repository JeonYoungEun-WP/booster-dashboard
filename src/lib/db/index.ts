/**
 * Drizzle DB 클라이언트 — Supabase Postgres 연결.
 *
 * 환경변수:
 *   POSTGRES_URL              — 서버리스 풀러용 (transaction mode, port 6543 또는 connection pooler URL)
 *   POSTGRES_URL_NON_POOLING  — 마이그레이션·세션 단위 작업용 (port 5432)
 *
 * Supabase 에서 두 URL 모두 제공 (Settings → Database → Connection string).
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

declare global {
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined
}

function getClient() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      'POSTGRES_URL 환경변수가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수를 확인하세요.',
    )
  }
  // 서버리스 콜드스타트 사이 재사용 (dev hot-reload 도 같이 적용)
  if (!globalThis.__pgClient) {
    globalThis.__pgClient = postgres(process.env.POSTGRES_URL, {
      prepare: false,                  // Supabase pooler 호환
      max: 1,                          // 서버리스 함수당 단일 연결
      idle_timeout: 20,
    })
  }
  return globalThis.__pgClient
}

export const db = drizzle(getClient())
