'use client'

import { useEffect } from 'react'

/**
 * 전역 에러 바운더리 — 렌더/데이터 로딩 중 예외 발생 시 표시된다.
 * 기존 페이지의 에러 박스 스타일(rounded-xl border-red-200 bg-red-50)과 통일.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 콘솔에 에러 기록 (디버깅용)
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <div className="max-w-md w-full rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-lg font-semibold text-red-700 mb-2">문제가 발생했습니다</p>
        <p className="text-sm text-red-700/80 mb-4 break-words">
          {error.message || '알 수 없는 오류가 발생했습니다.'}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="text-sm rounded-md bg-red-600 text-white px-4 py-2 hover:bg-red-700 transition-colors font-medium"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
