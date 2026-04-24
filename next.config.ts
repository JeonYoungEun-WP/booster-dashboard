import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // 레거시 이벤트 URL → 새 스코프 URL
      // /analytics/1042 → /analytics/event/1042
      {
        source: '/analytics/:eventId(\\d+)',
        destination: '/analytics/event/:eventId',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
