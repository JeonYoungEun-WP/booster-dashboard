/**
 * Drizzle Kit 설정 — 스키마 마이그레이션·DB push 용.
 *
 * 사용:
 *   npx drizzle-kit generate    # 스키마 변경 → SQL 마이그레이션 생성
 *   npx drizzle-kit migrate     # 마이그레이션 적용
 *   npx drizzle-kit push        # 개발 단계 빠른 적용 (마이그레이션 파일 없이 직접 push)
 *   npx drizzle-kit studio      # 웹 UI
 *
 * 환경변수:
 *   POSTGRES_URL_NON_POOLING 가 있으면 우선 사용 (마이그레이션은 세션 연결 필요)
 *   없으면 POSTGRES_URL fallback
 */

import { config } from 'dotenv'
import type { Config } from 'drizzle-kit'

config({ path: '.env.local' })

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL

if (!url) {
  throw new Error('POSTGRES_URL_NON_POOLING 또는 POSTGRES_URL 환경변수가 필요합니다.')
}

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  schemaFilter: ['chatbot'],
  verbose: true,
  strict: true,
} satisfies Config
