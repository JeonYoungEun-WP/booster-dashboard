import { redirect } from 'next/navigation'
import { DEFAULT_BRAND_ID } from '@/src/lib/scope-catalog'

/**
 * /analytics → 기본 브랜드 성과 분석으로 리다이렉트.
 * 브레드크럼 셀렉터에서 프로젝트/랜딩페이지 수준으로 드릴다운 가능.
 */
export default function AnalyticsIndex() {
  redirect(`/analytics/brand/${DEFAULT_BRAND_ID}`)
}
