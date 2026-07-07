import { describe, it, expect } from 'vitest'
import {
  fmtNumber, fmtKRW, fmtKRWCompact, fmtRatioPct, fmtPct, fmtDuration,
} from '@/src/lib/format'

describe('fmtNumber', () => {
  it('천단위 구분 정수 표기 (반올림)', () => {
    expect(fmtNumber(12345.6)).toBe('12,346')
    expect(fmtNumber(1000)).toBe('1,000')
    expect(fmtNumber(0)).toBe('0')
  })
})

describe('fmtKRW', () => {
  it('원화 기호 + 천단위 구분', () => {
    expect(fmtKRW(1234567)).toBe('₩1,234,567')
  })
})

describe('fmtRatioPct vs fmtPct — 단위 구분이 핵심', () => {
  it('fmtRatioPct 는 0~1 비율을 입력받아 %로 변환', () => {
    expect(fmtRatioPct(0.0532)).toBe('5.32%')
  })

  it('fmtPct 는 이미 % 단위인 값을 그대로 표기', () => {
    expect(fmtPct(5.32)).toBe('5.32%')
  })

  it('같은 결과지만 입력 단위가 100배 다르다', () => {
    // 5.32% 를 얻으려면 fmtRatioPct 는 0.0532, fmtPct 는 5.32
    expect(fmtRatioPct(0.0532)).toBe(fmtPct(5.32))
  })
})

describe('fmtKRWCompact — 축약 표기와 경계값', () => {
  it('백만 이상은 M 표기', () => {
    expect(fmtKRWCompact(4195099)).toBe('₩4.2M')
  })

  it('만 이상 백만 미만은 만 표기', () => {
    expect(fmtKRWCompact(85000)).toBe('₩8.5만')
  })

  it('경계값 10,000 (만 단위 시작)', () => {
    expect(fmtKRWCompact(10_000)).toBe('₩1.0만')
    // 만 미만은 원화 그대로
    expect(fmtKRWCompact(9_999)).toBe('₩9,999')
  })

  it('경계값 1,000,000 (M 단위 시작)', () => {
    expect(fmtKRWCompact(1_000_000)).toBe('₩1.0M')
    // 백만 미만은 만 표기
    expect(fmtKRWCompact(999_999)).toBe('₩100.0만')
  })
})

describe('fmtDuration', () => {
  it('60초 이상은 분·초 표기', () => {
    expect(fmtDuration(83)).toBe('1분 23초')
  })

  it('60초 미만은 초만 표기', () => {
    expect(fmtDuration(45)).toBe('45초')
  })

  it('정확히 60초는 1분 0초', () => {
    expect(fmtDuration(60)).toBe('1분 0초')
  })
})
