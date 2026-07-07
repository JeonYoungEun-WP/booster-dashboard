/**
 * [scope]/[id] 성과분석 라우트 로딩 표시.
 * 기존 페이지의 "데이터를 불러오는 중..." 텍스트 스타일과 통일.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center text-base text-muted-foreground py-20">
        데이터를 불러오는 중...
      </div>
    </div>
  )
}
