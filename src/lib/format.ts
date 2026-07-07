/**
 * 공용 포맷 유틸 — 컴포넌트·리포트 빌더 전역에서 이 파일만 사용할 것.
 *
 * ⚠️ 퍼센트 함수는 입력 단위로 이름을 구분한다 (100배 오차 사고 방지):
 *   - fmtRatioPct(0.0532)  → "5.32%"   (0~1 비율 입력)
 *   - fmtPct(5.32)         → "5.32%"   (이미 % 값 입력)
 * ROAS 판정 기준도 단위에 따라 다르다: 비율이면 1 이상, % 값이면 100 이상이 흑자.
 */

/** 천단위 구분 정수 표기. 예: 12345.6 → "12,346" */
export function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

/** 원화 표기. 예: 1234567 → "₩1,234,567" */
export function fmtKRW(n: number): string {
  return '₩' + fmtNumber(n)
}

/** 원화 축약 표기 (차트 축·좁은 셀용). 예: 4195099 → "₩4.2M", 85000 → "₩8.5만" */
export function fmtKRWCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `₩${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `₩${(n / 10_000).toFixed(1)}만`
  return fmtKRW(n)
}

/** 0~1 비율 → 퍼센트. 예: 0.0532 → "5.32%" */
export function fmtRatioPct(ratio: number, digits = 2): string {
  return `${(ratio * 100).toFixed(digits)}%`
}

/** 이미 % 단위인 값 → 퍼센트. 예: 5.32 → "5.32%" */
export function fmtPct(pct: number, digits = 2): string {
  return `${pct.toFixed(digits)}%`
}

/** 초 → "N분 M초". 예: 83 → "1분 23초" */
export function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m === 0) return `${s}초`
  return `${m}분 ${s}초`
}

/** @deprecated fmtNumber 를 사용하라. 하위 호환용 별칭. */
export const formatNumber = fmtNumber
