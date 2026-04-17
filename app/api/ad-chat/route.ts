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

export async function POST(req: Request) {
  const body = await req.json()
  const messages = (body.messages || []).map((msg: Record<string, unknown>) => {
    if (msg.content) return msg
    const parts = msg.parts as Array<{ type: string; text?: string }> | undefined
    const text = parts?.filter(p => p.type === 'text').map(p => p.text).join('') || ''
    return { role: msg.role, content: text }
  })

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: `당신은 위픽부스터(B2B 마케팅 SaaS, booster.im)의 광고 성과 분석가입니다.
Google Ads, Meta Ads, 네이버 검색광고, 카카오모먼트 데이터를 통합 분석합니다.

중요 규칙:
- 사용자가 질문하면 절대 되묻지 말고 바로 도구를 호출해 데이터를 가져온 뒤 답하세요.
- 기간이 명시되지 않으면 기본 최근 30일(30daysAgo ~ yesterday) 데이터를 조회하세요.
- "성과", "ROAS", "CPA", "전환" 관련 질문에는 getChannelSummary를 호출하세요.
- "추이", "트렌드" 관련 질문에는 getDailyTrend를 호출하세요.
- "캠페인" 관련 질문에는 getCampaignPerformance를 호출하세요.
- "소재", "크리에이티브", "배너", "영상", "헤드라인" 관련 질문에는 getCreativePerformance를 호출하세요.
- 도구 호출 결과를 인용할 때는 반드시 구체적 수치(원/회/%)를 포함하세요.

답변 형식:
- 핵심 인사이트는 bullet point(• )로
- 수치는 통화/숫자 포맷으로 표시
- 채널별 비교, 효율 좋은/나쁜 항목 강조
- 실행 가능한 액션 아이템 제시
- 차트가 도움이 되면 chartData 도구를 호출 (최대 4개 시리즈)
- 한국어로 답변
- B2B 서비스이므로 주말 트래픽 저조는 정상

지표 정의:
- CTR(클릭률) = 클릭/노출
- CPC(클릭당 비용) = 비용/클릭
- CVR(전환율) = 전환/클릭
- CPA(전환당 비용) = 비용/전환
- ROAS(광고대비매출) = 전환금액/비용 (%, 100% = 본전)`,
    messages,
    tools: {
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
