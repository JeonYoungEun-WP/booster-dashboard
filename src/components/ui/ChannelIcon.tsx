import type { AdChannel } from '@/src/lib/ad-data'

interface Props {
  channel: AdChannel
  size?: number
  className?: string
}

/**
 * 각 광고 채널 공식 로고를 간소화한 브랜드 마크.
 * 외부 asset 없이 인라인 SVG로 렌더.
 */
export function ChannelIcon({ channel, size = 16, className }: Props) {
  const s = size
  switch (channel) {
    case 'google':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" className={className} aria-label="Google" role="img">
          <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.2 7.9 3.1l5.7-5.7A20 20 0 1 0 44 24c0-1.3-.1-2.6-.4-3.9z"/>
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.2 7.9 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.6-.4-3.9z"/>
        </svg>
      )
    case 'meta':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" className={className} aria-label="Meta" role="img">
          <defs>
            <linearGradient id="meta-g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0081FB"/>
              <stop offset="100%" stopColor="#B72CD6"/>
            </linearGradient>
          </defs>
          <path fill="url(#meta-g)" d="M24 8c-8 0-14 8-14 16 0 8 5 16 12 16 4 0 6-3 8-6l4-6c2-3 3-5 5-5 2 0 3 1 3 4 0 6-4 13-9 13-3 0-5-2-7-4l-3-4c-2-3-3-4-4-4-1 0-2 1-2 3 0 4 4 9 8 9 6 0 13-7 13-16S32 8 24 8zm0 7c4 0 7 5 7 9 0 3-1 5-3 5-2 0-3-2-5-5l-3-4c-1-2-2-3-4-3-3 0-6 3-6 7 0 6 6 11 11 11 5 0 10-5 10-12s-5-12-11-12h4z"/>
        </svg>
      )
    case 'naver':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" className={className} aria-label="Naver" role="img">
          <rect width="48" height="48" rx="8" fill="#03C75A"/>
          <path fill="#fff" d="M14 13h7l6 10V13h7v22h-7l-6-10v10h-7z"/>
        </svg>
      )
    case 'kakao':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" className={className} aria-label="Kakao" role="img">
          <rect width="48" height="48" rx="8" fill="#FEE500"/>
          <path fill="#191919" d="M24 11c-8 0-14 5-14 11 0 4 3 7 7 9l-1 5c0 1 1 1 2 1l6-4h1c7 0 13-5 13-11S32 11 24 11z"/>
        </svg>
      )
  }
}

/**
 * 작은 circle fallback — 아이콘 대신 색상 배지 쓸 때.
 */
export function ChannelDot({ channel, size = 8 }: { channel: AdChannel; size?: number }) {
  const color: Record<AdChannel, string> = {
    google: '#4285F4', meta: '#1877F2', naver: '#03C75A', kakao: '#FEE500',
  }
  return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, backgroundColor: color[channel] }} />
}
