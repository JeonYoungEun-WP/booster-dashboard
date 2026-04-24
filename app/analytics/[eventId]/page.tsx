import { redirect } from 'next/navigation'

/**
 * 레거시 URL 호환:
 *   /analytics/1042          → /analytics/event/1042
 *   /analytics/3550?q=...    → /analytics/event/3550?q=...
 *
 * 숫자 ID 만 매칭 — `/analytics/brand`, `/analytics/project` 는 [scope]/[id] 로 간다.
 */
interface Props {
  params: Promise<{ eventId: string }>
}

export default async function LegacyEventRedirect({ params }: Props) {
  const { eventId } = await params
  // scope 세그먼트와 충돌 방지 — brand/project/event 는 [scope]/[id] 경로가 처리
  if (eventId === 'brand' || eventId === 'project' || eventId === 'event') {
    // 이 경로는 이 파일이 잡으면 안 되는 케이스 — fall through to [scope]/[id]
    redirect(`/analytics`)
  }
  redirect(`/analytics/event/${eventId}`)
}
