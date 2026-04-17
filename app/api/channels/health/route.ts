import { NextResponse } from 'next/server'
import { healthCheck as naverHealth } from '@/src/lib/channels/naver'
import { healthCheck as karrotHealth } from '@/src/lib/channels/karrot'
import { isServerOnAllowedIp, ALLOWED_MEDIA_API_IP } from '@/src/lib/ip-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const [naver, karrot] = await Promise.all([
    naverHealth().catch((e) => ({ ok: false, error: (e as Error).message })),
    karrotHealth().catch((e) => ({ ok: false, mode: 'none' as const, error: (e as Error).message })),
  ])
  return NextResponse.json({
    ipAllowed: isServerOnAllowedIp(),
    allowedIp: ALLOWED_MEDIA_API_IP,
    naver,
    karrot,
  })
}
