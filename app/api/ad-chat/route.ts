import { streamText, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import {
  getChannelSummary,
  getDailyTrend,
  getDailyByChannel,
  getCampaignPerformance,
  getCreativePerformance,
  getTotalSummary,
  getIntegrationStatus,
  type AdChannel,
} from '@/src/lib/ad-data'

export const maxDuration = 120

function resolveDate(d: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  const now = new Date()
  if (d === 'yesterday') { now.setDate(now.getDate() - 1); return now.toISOString().slice(0, 10) }
  if (d === 'today') return now.toISOString().slice(0, 10)
  const m = d.match(/^(\d+)daysAgo$/)
  if (m) { now.setDate(now.getDate() - parseInt(m[1])); return now.toISOString().slice(0, 10) }
  return d
}

const periodSchema = z.object({
  startDate: z.string().describe('시작일 (YYYY-MM-DD 또는 7daysAgo, 30daysAgo, yesterday)'),
  endDate: z.string().describe('종료일 (YYYY-MM-DD 또는 yesterday)'),
  channels: z.array(z.enum(['google', 'meta', 'naver', 'kakao'])).optional().describe('조회할 채널. 미지정시 전체'),
})

const chartSchema = z.object({
  title: z.string().describe('차트 제목'),
  type: z.enum(['bar', 'line', 'pie']).describe('차트 타입'),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    value2: z.number().optional(),
    value3: z.number().optional(),
    value4: z.number().optional(),
  })).describe('차트 데이터 배열. 최대 4개 시리즈 지원'),
  series: z.array(z.object({
    key: z.enum(['value', 'value2', 'value3', 'value4']),
    label: z.string(),
    color: z.string().optional(),
  })).optional(),
  valueLabel: z.string().optional(),
  value2Label: z.string().optional(),
})

type PeriodParams = z.infer<typeof periodSchema>

function normalize(p: PeriodParams) {
  return {
    startDate: resolveDate(p.startDate),
    endDate: resolveDate(p.endDate),
    channels: p.channels as AdChannel[] | undefined,
  }
}

// 이벤트 URL 에서 ID 추출 (예: /analytics/1042, /analytics/3550?legacySlug=...)
function extractEventIdFromUrl(text: string): string | null {
  const m = text.match(/\/analytics\/(\d+)/)
  return m ? m[1] : null
}

/** 이벤트 퍼널 분석 응답 축약 — AI 토큰 절약 */
interface FunnelSummary {
  eventId: string
  advertiser: string | null
  period: { startDate: string; endDate: string }
  realData: boolean
  funnel: {
    adSpend: number; impressions: number; clicks: number
    sessions: number; pageViews: number
    leads: number; visitReservations: number; reservations: number
    averageOrderValue: number; reservationRevenue: number
    ctr: number; cpc: number
    cpa_lead: number; cpa_visitReservation: number; cpa_reservation: number
    cvr_lead: number; cvr_reservation: number; cvr_contract: number
    roas: number
  }
  byChannel: Array<{
    channel: string; adSpend: number; impressions: number; clicks: number
    leads: number; reservations: number; contracts: number
    revenue: number; roas: number
    cpa_lead: number; cpa_reservation: number; cpa_contract: number
  }>
  topTrackingCodes: Array<{
    trackingCode: string; adSpend: number; clicks: number
    leads: number; reservations: number
    cpa_lead: number; reservationROAS: number
  }>
  dataSources: {
    ga4: string   // 'real' | 'dummy' | 'unavailable'
    leads: string // 'real-timestamps' | 'dummy' | 'real-db'
    clarity: string
  }
}

async function fetchEventFunnel(
  origin: string,
  eventId: string,
  startDate?: string,
  endDate?: string,
): Promise<FunnelSummary> {
  const qs = new URLSearchParams({ eventId })
  if (startDate) qs.set('startDate', startDate)
  if (endDate) qs.set('endDate', endDate)
  const res = await fetch(`${origin}/api/event-analytics?${qs}`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`event-analytics 조회 실패 (${res.status}): ${await res.text().catch(() => '')}`)
  }
  const data = await res.json()
  const f = data.funnel
  return {
    eventId: data.eventId,
    advertiser: data.realDataNote?.advertiser ?? null,
    period: data.period,
    realData: !!data.realDataNote,
    funnel: {
      adSpend: f.adSpend,
      impressions: f.impressions,
      clicks: f.clicks,
      sessions: f.sessions,
      pageViews: f.pageViews,
      leads: f.leads,
      visitReservations: f.visitReservations,
      reservations: f.reservations,
      averageOrderValue: f.averageOrderValue,
      reservationRevenue: f.reservationRevenue,
      ctr: f.ctr,
      cpc: f.cpc,
      cpa_lead: f.cpa_lead,
      cpa_visitReservation: f.cpa_visitReservation,
      cpa_reservation: f.cpa_reservation,
      cvr_lead: f.cvr_session_to_lead,
      cvr_reservation: f.cvr_lead_to_visitReservation,
      cvr_contract: f.cvr_visitReservation_to_payment,
      roas: f.trueROAS_estimated,
    },
    byChannel: (data.byChannel ?? []).map((c: Record<string, unknown>) => ({
      channel: c.channel as string,
      adSpend: c.adSpend as number,
      impressions: c.impressions as number,
      clicks: c.clicks as number,
      leads: c.leads as number,
      reservations: c.reservations as number,
      contracts: c.contracts as number,
      revenue: c.revenue as number,
      roas: c.roas as number,
      cpa_lead: c.cpa_lead as number,
      cpa_reservation: c.cpa_reservation as number,
      cpa_contract: c.cpa_contract as number,
    })),
    topTrackingCodes: (data.byTrackingCode ?? []).slice(0, 8).map((t: Record<string, unknown>) => ({
      trackingCode: t.trackingCode as string,
      adSpend: t.adSpend as number,
      clicks: t.clicks as number,
      leads: t.leads as number,
      reservations: t.reservations as number,
      cpa_lead: t.cpa_lead as number,
      reservationROAS: t.reservationROAS as number,
    })),
    dataSources: {
      ga4: data.ga4?.simulated ? 'dummy (광고주 엑셀 기반)'
        : data.ga4?.unavailable ? 'unavailable'
          : data.ga4?.error ? `error: ${data.ga4.error}`
            : 'real (GA4 Data API)',
      leads: data.leads?.simulated ? 'dummy (광고주 제공 실 타임스탬프 기반)' : 'real DB',
      clarity: data.clarity?.unavailable ? 'unavailable' : data.clarity?.error ? `error: ${data.clarity.error}` : 'real',
    },
  }
}

export async function POST(req: Request) {
  const origin = new URL(req.url).origin
  const body = await req.json()
  const rawMessages = (body.messages || []) as Array<Record<string, unknown>>
  const messages = rawMessages.map((msg) => {
    if (msg.content) return { role: msg.role as string, content: String(msg.content) }
    const parts = msg.parts as Array<{ type: string; text?: string }> | undefined
    const text = parts?.filter(p => p.type === 'text').map(p => p.text).join('') || ''
    return { role: msg.role as string, content: text }
  }) as NonNullable<Parameters<typeof streamText>[0]['messages']>

  // 마지막 사용자 메시지에서 이벤트 ID 자동 추출 힌트
  const lastUser = rawMessages.filter((m) => m.role === 'user').pop()
  const lastUserText = (() => {
    if (lastUser?.content) return String(lastUser.content)
    const parts = lastUser?.parts as Array<{ type: string; text?: string }> | undefined
    return parts?.filter((p) => p.type === 'text').map((p) => p.text).join('') || ''
  })()
  const autoEventId = extractEventIdFromUrl(lastUserText)

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: `당신은 위픽부스터(B2B 마케팅 SaaS, booster.im)의 광고 성과 분석가입니다.
두 종류 데이터를 통합 분석합니다:

1. **이벤트(랜딩 페이지) 퍼널** — getEventFunnel 도구
   - 광고주별 실 이벤트 데이터 (현재 1042=더블어스, 3550=(주)굿리치)
   - 풀 퍼널: 노출 → 클릭 → 세션 → 리드 → 방문예약 → 결제
   - 채널별 성과, 트래킹코드(광고세트)별 ROAS, 데이터 소스 표기

2. **시뮬레이션 전체 광고 데이터** — getTotalSummary · getChannelSummary 등
   - 매체 API 연동 전 더미 (Google·Meta·Naver·Kakao·TikTok·당근)

도구 사용 규칙:
- 사용자 질문에 **이벤트 ID (예: 1042, 3550) 또는 /analytics/<id> URL** 이 포함되면 **getEventFunnel** 을 먼저 호출하세요.
- URL/ID 없이 "성과", "채널", "ROAS" 물어보면 getChannelSummary 사용.
- "추이/트렌드" → getDailyTrend, "캠페인" → getCampaignPerformance, "소재" → getCreativePerformance.
- 절대 되묻지 말고 도구 먼저 호출. 기간 미지정시 최근 30일 (30daysAgo ~ yesterday).
${autoEventId ? `- 현재 대화 맥락에서 이벤트 ID ${autoEventId} 가 감지됐습니다. 이벤트 관련 질문이면 이 ID로 getEventFunnel 호출하세요.` : ''}

답변 형식:
- 핵심 인사이트는 bullet point(• )로
- 수치는 통화/숫자 포맷으로 표시
- 채널별 비교, 효율 좋은/나쁜 항목 강조
- 이벤트 분석 시 반드시 포함:
  1) 핵심 숫자 (광고비, 리드, 예약, 결제, ROAS)
  2) 채널별 비교 (어디가 이겼나)
  3) 트래킹코드(광고세트) 중 best·worst 3개
  4) 개선 액션 제안 (광고비 재배분, 효율 낮은 세트 정리 등)
  5) 데이터 소스 신뢰도 참고 (dummy 섞여 있으면 표기)
- 차트가 도움이 되면 chartData 도구 호출 (최대 4개 시리즈)
- 한국어, 구체 수치 포함
- B2B 서비스이므로 주말 트래픽 저조는 정상

지표 정의:
- CTR = 클릭/노출, CPC = 비용/클릭
- CVR = 리드/클릭 또는 예약/리드 등 단계별 전환율
- CPA = 비용/리드 (또는 비용/예약, 비용/결제)
- ROAS = 매출/비용 (%, 100% = 본전)

표기 규칙:
- "전환" 또는 "전환수" 는 본문·표·차트에서 "전환(리드수)" 로 표기.
- 이 서비스에서 전환 = B2B 리드 발생 건수.`,
    messages,
    tools: {
      getEventFunnel: {
        description: `특정 이벤트(랜딩 페이지) 의 풀 퍼널 분석 데이터를 조회합니다.
사용자가 이벤트 ID (예: 1042, 3550) 또는 /analytics/<id> URL 을 언급하거나,
특정 광고주 (예: 더블어스, 굿리치) 의 이벤트를 분석해달라고 할 때 사용.

반환 필드:
- advertiser: 광고주명
- funnel: 노출·클릭·세션·리드·방문예약·결제·CPA·CVR·ROAS
- byChannel: 채널별 (Meta·TikTok 등) 풀 퍼널 수치
- topTrackingCodes: 트래킹코드(광고세트)별 성과 상위
- dataSources: 각 데이터의 실·더미 여부`,
        inputSchema: z.object({
          eventId: z.string().describe('이벤트 ID. 예: "1042" (더블어스), "3550" ((주)굿리치)'),
          startDate: z.string().optional().describe('시작일 YYYY-MM-DD (미지정시 이벤트 기본 기간)'),
          endDate: z.string().optional().describe('종료일 YYYY-MM-DD'),
        }),
        execute: async ({ eventId, startDate, endDate }) => {
          return await fetchEventFunnel(origin, eventId, startDate, endDate)
        },
      },
      getTotalSummary: {
        description: '전체 채널의 합계 광고 성과를 조회합니다. 노출, 클릭, 비용, 전환, CTR/CPC/CVR/CPA/ROAS 등.',
        inputSchema: periodSchema,
        execute: async (p) => getTotalSummary(normalize(p)),
      },
      getChannelSummary: {
        description: '채널별 광고 성과를 조회합니다. (Google, Meta, Naver, Kakao)',
        inputSchema: periodSchema,
        execute: async (p) => getChannelSummary(normalize(p)),
      },
      getDailyTrend: {
        description: '일자별 광고 성과 추이를 조회합니다.',
        inputSchema: periodSchema,
        execute: async (p) => getDailyTrend(normalize(p)),
      },
      getDailyByChannel: {
        description: '일자별 채널별 비용 분포를 조회합니다.',
        inputSchema: periodSchema,
        execute: async (p) => getDailyByChannel(normalize(p)),
      },
      getCampaignPerformance: {
        description: '캠페인별 상세 성과를 조회합니다.',
        inputSchema: periodSchema,
        execute: async (p) => getCampaignPerformance(normalize(p)),
      },
      getCreativePerformance: {
        description: '소재(크리에이티브)별 상세 성과를 조회합니다. 포맷(image/video/carousel/text), 헤드라인, 채널별로 어떤 소재가 성과가 좋은지 분석합니다.',
        inputSchema: periodSchema,
        execute: async (p) => getCreativePerformance(normalize(p)),
      },
      getIntegrationStatus: {
        description: '광고매체 API 연결 상태를 조회합니다.',
        inputSchema: z.object({}),
        execute: async () => getIntegrationStatus(),
      },
      chartData: {
        description: '채팅에 차트를 표시합니다. 데이터와 차트 타입을 지정하면 UI에서 렌더링됩니다.',
        inputSchema: chartSchema,
        execute: async (params) => ({ rendered: true, title: params.title, type: params.type, dataCount: params.data.length }),
      },
    },
    stopWhen: stepCountIs(6),
  })

  return result.toUIMessageStreamResponse()
}
