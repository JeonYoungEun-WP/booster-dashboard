import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// alias 배열은 첫 매치만 적용되므로(fallback 없음) 루트 단일 매핑만 둔다.
// 프로젝트 import 관례는 "@/src/..." (루트 기준) — 테스트도 동일 관례를 따른다.
const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: `${rootDir}$1` },
    ],
  },
  test: {
    // 테스트 글로브: src 하위의 *.test.ts 만
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
