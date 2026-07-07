import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { isServerOnAllowedIp, canCallMediaApi, ALLOWED_MEDIA_API_IP } from '@/src/lib/ip-guard'

// 매체 API IP 가드 — 최우선 운영 규칙 (222.109.27.119 에서만 실 호출 허용)
const ORIGINAL = process.env.SERVER_PUBLIC_IP

beforeEach(() => {
  delete process.env.SERVER_PUBLIC_IP
})

afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.SERVER_PUBLIC_IP
  else process.env.SERVER_PUBLIC_IP = ORIGINAL
})

describe('isServerOnAllowedIp', () => {
  it('SERVER_PUBLIC_IP 미설정이면 false', () => {
    expect(isServerOnAllowedIp()).toBe(false)
  })

  it('허가 IP(222.109.27.119)와 일치하면 true', () => {
    process.env.SERVER_PUBLIC_IP = ALLOWED_MEDIA_API_IP
    expect(isServerOnAllowedIp()).toBe(true)
  })

  it('다른 IP 값이면 false', () => {
    process.env.SERVER_PUBLIC_IP = '1.2.3.4'
    expect(isServerOnAllowedIp()).toBe(false)
  })
})

describe('canCallMediaApi', () => {
  it('서버 IP 단일 기준으로만 판정한다 (인자 없음 — 요청 헤더 신뢰 경로 제거됨)', () => {
    // R1 보안 수정의 회귀 방지: 함수가 파라미터를 받지 않아야 한다
    expect(canCallMediaApi.length).toBe(0)

    expect(canCallMediaApi()).toBe(false)
    process.env.SERVER_PUBLIC_IP = ALLOWED_MEDIA_API_IP
    expect(canCallMediaApi()).toBe(true)
  })
})
