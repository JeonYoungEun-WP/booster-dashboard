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
import { buildEventAnalytics } from '@/src/lib/event-analytics-service'

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

// 구조화 표 렌더링 스키마 — 컬럼별 포맷 지정 가능
const tableSchema = z.object({
  title: z.string().describe('표 제목'),
  subtitle: z.string().optional().describe('부제목 / 행 수 · 정렬 기준 등'),
  columns: z.array(z.object({
    key: z.string().describe('행 객체의 키'),
    header: z.string().describe('헤더 표시 문구'),
    format: z.enum(['text', 'number', 'currency', 'percent', 'roas', 'code']).default('text').describe('값 포맷. currency=₩·천단위, percent=×100 → %, roas=×100 → %(1이상 녹색), code=모노스페이스'),
    align: z.enum(['left', 'right', 'center']).optional().describe('미지정시 format 기준 자동 (숫자 계열 우측, 텍스트 좌측)'),
  })).min(1).max(10).describe('컬럼 정의 (최대 10개)'),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
    .min(1).max(50)
    .describe('표 데이터. 각 행은 컬럼 key 에 매핑되는 값을 가진 객체.'),
  footer: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional()
    .describe('합계/요약 행 (선택). 컬럼 key 매핑 객체.'),
  highlightRule: z.enum(['top-roas', 'bottom-roas', 'none']).optional().default('none')
    .describe('행 하이라이트 규칙. top-roas=ROAS 최고 녹색, bottom-roas=ROAS 최저 주황'),
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
  eventId: string,
  startDate?: string,
  endDate?: string,
): Promise<FunnelSummary> {
  // 내부 함수 직접 호출 — HTTP hop 없음 · Vercel 보호 영향 없음
  const data = await buildEventAnalytics({ eventId, startDate, endDate })
  const f = data.funnel
  const ga4 = data.ga4 as { simulated?: boolean; unavailable?: boolean; error?: string } | null
  const leads = data.leads as { simulated?: boolean } | null
  const clarity = data.clarity as { unavailable?: boolean; error?: string } | null
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
      ga4: ga4?.simulated ? 'dummy (광고주 엑셀 기반)'
        : ga4?.unavailable ? 'unavailable'
          : ga4?.error ? `error: ${ga4.error}`
            : 'real (GA4 Data API)',
      leads: leads?.simulated ? 'dummy (광고주 제공 실 타임스탬프 기반)' : 'real DB',
      clarity: clarity?.unavailable ? 'unavailable' : clarity?.error ? `error: ${clarity.error}` : 'real',
    },
  }
}

export async function POST(req: Request) {
  // Gemini key 미설정 조기 감지 (UI 에 명확한 에러 전달)
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('[ad-chat] GOOGLE_GENERATIVE_AI_API_KEY env 가 설정되지 않았습니다.')
    return new Response(
      JSON.stringify({ error: 'GOOGLE_GENERATIVE_AI_API_KEY 가 Vercel 에 등록되지 않았거나 재배포가 필요합니다.' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

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
    system: `당신은 위픽부스터(B2B 마케팅 SaaS, booster.im)의 **풀 퍼널 성과 분석가 "ai MAX"** 입니다.

## 🎯 분석 범위 — 광고 × 상담 × 최종 예약 통합
당신은 단순 광고 효율 분석가가 아니라, **광고 투입부터 최종 매출 발생까지 전 구간의 성과를 통합 분석**합니다.

### 풀 퍼널 3단계
\`\`\`
[광고 단계]           [상담 단계]            [최종 예약 단계]
노출 → 클릭 → 세션     리드 → 통화/상담       방문예약 → 결제(계약)
                       → 예약완료·거절·무응답   → 매출 발생
──────────────────────────────────────────────────────────────
CPC · CTR · 세션CVR   리드→상담CVR           예약→결제CVR
CPA(리드)             CPA(예약)              CPA(결제) · 최종 ROAS
\`\`\`

### 분석 관점 (항상 세 겹으로 본다)
1. **광고 성과** — 광고비·노출·클릭·CTR·CPC, 매체 간 효율, 캠페인·소재 단위
2. **상담 성과** — 리드 수, 상담 응답률, 예약완료 전환율, 거절/무응답 비율, 광고세트별 리드 품질
3. **최종 예약 성과** — 방문예약 → 결제 전환율, 매출, **최종 ROAS (결제 기준)**, 광고비 1원당 매출 회수

**⚠️ 핵심 프레임**: "클릭 많다 = 좋은 광고" 가 아니라 "광고비 1원으로 결제 1원을 얼마나 회수했나" 가 최종 판단 기준.
CPA(리드) 낮아도 리드→결제 전환이 약하면 광고 자체에 문제 ⇒ 광고세트 크리에이티브·타겟팅 재점검 제안.
반대로 CPA(리드) 높아도 결제 전환 강하면 예산 증액 가치 있음.

## 🔥 최우선 규칙 — 표(Table) 출력 강제
**표로 정리 가능한 데이터는 서술문 대신 반드시 tableData 도구로 출력하세요.**

다음은 **무조건 tableData 호출** (예외 없음):
1. 채널별/매체별 비교 (Meta · TikTok · Google · Naver · Kakao · 당근)
2. 캠페인 TOP N 또는 BOTTOM N
3. 트래킹코드(광고세트)별 성과 (2개 이상)
4. 일자별 추이 (3일 이상)
5. 크리에이티브·소재별 성과
6. 광고비·CPA·ROAS 를 포함한 모든 비교
7. **풀퍼널 단계별 수치** (노출/클릭/세션/리드/예약/결제)

**풀 퍼널 채널 비교 표 예시** (필수 컬럼):
tableData({
  title: "채널별 풀 퍼널 성과",
  subtitle: "광고 → 상담 → 예약 → 결제 · 최종 ROAS 내림차순",
  columns: [
    { key: "channel", header: "채널", format: "text" },
    { key: "spend", header: "광고비", format: "currency" },
    { key: "clicks", header: "클릭", format: "number" },
    { key: "leads", header: "리드(상담)", format: "number" },
    { key: "reservations", header: "예약", format: "number" },
    { key: "contracts", header: "결제", format: "number" },
    { key: "cpa_lead", header: "CPA(리드)", format: "currency" },
    { key: "cpa_contract", header: "CPA(결제)", format: "currency" },
    { key: "roas", header: "최종 ROAS", format: "roas" }
  ],
  rows: [ ... ],
  footer: { channel: "합계", ... },
  highlightRule: "top-roas"
})

**tableData 호출 후 본문 서술은 "인사이트·다음 액션" 만** — 수치 나열 금지.

## 📊 데이터 소스
1. **이벤트 퍼널** — getEventFunnel (1042=더블어스, 3550=(주)굿리치)
   - funnel.leads / visitReservations / reservations → 상담·예약·결제 단계 수치
   - byChannel.*.cpa_lead / cpa_reservation / cpa_contract → 단계별 CPA
   - byChannel.*.roas → 최종 ROAS
   - topTrackingCodes.*.reservationROAS → 광고세트별 최종 결제 ROAS
2. **전체 광고 시뮬레이션** — getTotalSummary / getChannelSummary / getDailyTrend / getCampaignPerformance / getCreativePerformance (광고 상단부만 — 리드·예약 없음)

## 🛠 도구 사용 순서
1. 이벤트 ID (예: 1042, 3550) 또는 /analytics/<id> URL 감지 → **getEventFunnel 먼저** (풀 퍼널 모두 확보)
2. URL/ID 없는 일반 광고 질문 → getChannelSummary / getDailyTrend / getCampaignPerformance / getCreativePerformance
3. 기간 미지정 시 최근 30일
4. 절대 되묻지 말고 도구 먼저 호출
${autoEventId ? `5. 🎯 현재 맥락에서 **이벤트 ID ${autoEventId}** 감지됨 — 이 ID 로 getEventFunnel 호출.` : ''}

## 📝 답변 구성 (표 + 최소 서술)
\`\`\`
[표 1: 풀 퍼널 채널별 성과]
[표 2: 광고세트 TOP/BOTTOM — CPA(결제) · 최종 ROAS]
(선택) [표 3: 일자별 추이]

**💡 인사이트** (광고 × 상담 × 예약 세 겹으로)
• 광고 관점: (CTR/CPC/CPA 패턴)
• 상담 관점: (리드→상담 전환·리드 품질)
• 최종 예약 관점: (예약→결제·최종 ROAS 패턴)

**🎯 다음 액션** (실행 가능한 구체 제안 — 광고비 재분배 / 크리에이티브 교체 / 광고세트 중단·증액)
\`\`\`

## 📐 포맷 규칙
- **format 선택**:
  - \`currency\` (₩ 자동): 광고비, 매출, CPA, CPC
  - \`number\`: 노출, 클릭, 리드수, 예약수, 결제수
  - \`percent\` (0.05 → 5.00%): CTR, CVR
  - \`roas\` (자동 ±100% 컬러): ROAS · 효율비율
  - \`code\`: 트래킹코드 (모노스페이스)
  - \`text\`: 캠페인명, 채널명
- **highlightRule**: \`top-roas\` (최고 ROAS 녹색) 또는 \`bottom-roas\` (최저 ROAS 주황)
- **footer**: 합계/평균 행 있으면 포함
- "전환" → 항상 "전환(리드수)" 로 표기

## 💡 지표 정의 (풀 퍼널)
- CTR = 클릭/노출, CPC = 비용/클릭
- **CVR 단계별**: 클릭→세션 / 세션→리드 / **리드→예약(상담→예약완료)** / **예약→결제**
- **CPA 단계별**: CPA(리드) · CPA(예약) · **CPA(결제) ← 최종 고객 획득 단가**
- **최종 ROAS = 결제 매출 / 광고비** (100% = 본전)
- B2B 서비스이므로 주말 트래픽 저조는 정상

## 🎨 차트 (선택적)
패턴·추세 시각화에 유용한 경우만 chartData 호출:
- 일자별 추이 → line 차트
- 채널 비중 → pie 차트 (리드 기준)
- 캠페인 비교 → bar 차트
표로 충분한 경우 차트 생략.`,
    messages,
    tools: {
      getEventFunnel: {
        description: `특정 이벤트(랜딩 페이지) 의 **풀 퍼널 (광고 × 상담 × 최종 예약) 통합 데이터** 를 조회합니다.
사용자가 이벤트 ID (예: 1042, 3550) 또는 /analytics/<id> URL 을 언급하거나,
특정 광고주 (예: 더블어스, 굿리치) 의 이벤트를 분석해달라고 하거나,
리드·상담·예약·결제 어떤 단계든 물어볼 때 이 도구를 사용.

반환 필드 (광고 → 상담 → 최종 예약 전 구간):
- advertiser: 광고주명
- funnel: {
    adSpend, impressions, clicks, sessions,      // 광고 단계
    leads,                                        // 상담 진입 (리드)
    visitReservations,                            // 상담 → 예약완료
    reservations,                                 // 예약 → 결제 (최종 매출)
    cpa_lead, cpa_reservation, cpa_contract,      // 단계별 CPA
    cvr_lead, cvr_reservation, cvr_contract,      // 단계별 전환율
    roas                                          // 최종 ROAS (결제 매출 / 광고비)
  }
- byChannel: Meta·TikTok·Google 등 채널별 풀 퍼널 (adSpend → leads → reservations → contracts)
- topTrackingCodes: 광고세트별 — 리드수·예약수·CPA·최종 ROAS
- dataSources: 각 데이터의 실·더미 여부`,
        inputSchema: z.object({
          eventId: z.string().describe('이벤트 ID. 예: "1042" (더블어스), "3550" ((주)굿리치)'),
          startDate: z.string().optional().describe('시작일 YYYY-MM-DD (미지정시 이벤트 기본 기간)'),
          endDate: z.string().optional().describe('종료일 YYYY-MM-DD'),
        }),
        execute: async ({ eventId, startDate, endDate }) => {
          return await fetchEventFunnel(eventId, startDate, endDate)
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
      tableData: {
        description: `채팅에 **구조화 표**를 렌더링합니다. 광고 성과 비교(채널/캠페인/광고세트/일자)처럼 컬럼별 포맷이 필요한 모든 표 출력에 이 도구를 우선 사용하세요.
컬럼 format 은 다음 중 하나:
- text: 일반 문자
- number: 천단위 구분 (예: 1,636)
- currency: 원 통화 (예: ₩2,710,337)
- percent: 비율 (0.0523 → 5.23%)
- roas: ROAS 백분율 + 컬러 (1 이상 녹색, 미만 주황)
- code: 모노스페이스 (트래킹코드용)
rows 배열은 각 컬럼의 key 로 접근되는 객체. footer 는 선택 합계 행.`,
        inputSchema: tableSchema,
        execute: async (params) => ({
          rendered: true,
          title: params.title,
          columnCount: params.columns.length,
          rowCount: params.rows.length,
        }),
      },
    },
    stopWhen: stepCountIs(6),
    onError: (err) => {
      console.error('[ad-chat] streamText error:', err)
    },
  })

  return result.toUIMessageStreamResponse({
    onError: (err) => {
      console.error('[ad-chat] stream response error:', err)
      if (err instanceof Error) {
        return `AI 호출 오류: ${err.message}`
      }
      return `AI 호출 오류: ${String(err)}`
    },
  })
}
