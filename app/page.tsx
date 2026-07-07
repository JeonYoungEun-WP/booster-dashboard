import { redirect } from 'next/navigation'

/**
 * 루트(/) → 성과 분석으로 리다이렉트.
 * 구 대시보드 화면은 유령 페이지로 남겨두지 않고 /analytics 로 통합한다.
 */
export default function Home() {
  redirect('/analytics')
}
