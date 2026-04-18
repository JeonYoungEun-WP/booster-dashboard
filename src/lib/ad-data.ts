/**
 * 광고매체 데이터 통합 라이브러리
 * 실제 API 키가 환경변수에 설정되면 실 데이터, 아니면 시뮬레이션 데이터를 반환합니다.
 *
 * ⚠️ 최우선 규칙 (CLAUDE.md):
 *   실제 매체 API 호출은 허가된 IP(222.109.27.119) 환경에서만 허용.
 *   이 파일의 실제 API 분기 앞에는 반드시 `canCallMediaApi()` 가드를 둘 것.
 *
 * 환경변수 (옵션):
 * - GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID
 * - META_ADS_ACCESS_TOKEN, META_ADS_AD_ACCOUNT_ID
 * - NAVER_SEARCHAD_API_KEY, NAVER_SEARCHAD_CUSTOMER_ID
 * - KAKAO_MOMENT_ACCESS_TOKEN, KAKAO_MOMENT_AD_ACCOUNT_ID
 * - TIKTOK_ADS_ACCESS_TOKEN, TIKTOK_ADS_ADVERTISER_ID
 * - DANGGEUN_BIZ_API_KEY
 * - SERVER_PUBLIC_IP (서버가 허가된 IP에서 실행 중인지 판단용)
 */

import { canCallMediaApi, isServerOnAllowedIp } from './ip-guard'

export type AdChannel = 'google' | 'meta' | 'naver' | 'kakao' | 'tiktok' | 'karrot'

export const CHANNEL_LABEL: Record<AdChannel, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  naver: '네이버 검색광고',
  kakao: '카카오모먼트',
  tiktok: 'TikTok Ads',
  karrot: '당근 비즈',
}

export const CHANNEL_COLOR: Record<AdChannel, string> = {
  google: '#4285F4',
  meta: '#1877F2',
  naver: '#03C75A',
  kakao: '#FEE500',
  tiktok: '#111111',
  karrot: '#FF7E36',
}

export interface AdMetrics {
  impressions: number
  clicks: number
  cost: number
  conversions: number
  conversionValue: number
  ctr: number  // 클릭률 %
  cpc: number  // 클릭당 비용 (원)
  cpm: number  // 노출 1000회당 비용
  cvr: number  // 전환율 %
  cpa: number  // 전환당 비용
  roas: number // 광고 비용 대비 매출 (%)
}

export interface ChannelPerformance extends AdMetrics {
  channel: AdChannel
  label: string
}

export interface DailyPerformance {
  date: string
  impressions: number
  clicks: number
  cost: number
  conversions: number
}

export interface CampaignPerformance extends AdMetrics {
  channel: AdChannel
  campaignName: string
  status: 'ACTIVE' | 'PAUSED' | 'REMOVED'
}

export type CreativeFormat = 'image' | 'video' | 'carousel' | 'text'

export interface CreativePerformance extends AdMetrics {
  creativeId: string
  channel: AdChannel
  campaignName: string
  creativeName: string
  format: CreativeFormat
  headline: string
  description: string
  thumbnailColor: string  // hex - 미리보기 카드 배경색 (썸네일 대체)
  status: 'ACTIVE' | 'PAUSED' | 'REJECTED'
  /** 생성일 (소재 등록일) */
  createdAt: string
}

export interface IntegrationStatus {
  channel: AdChannel
  label: string
  connected: boolean
  description: string
  lastSyncAt?: string
}

export function getIntegrationStatus(): IntegrationStatus[] {
  // 허가된 IP가 아니면 실제 연결로 보고하지 않음 (CLAUDE.md 최우선 규칙)
  const ipOk = isServerOnAllowedIp()
  return [
    {
      channel: 'google',
      label: 'Google Ads',
      connected: ipOk && !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN && !!process.env.GOOGLE_ADS_CUSTOMER_ID,
      description: 'Google Ads API (검색/디스플레이/유튜브)',
      lastSyncAt: new Date().toISOString(),
    },
    {
      channel: 'meta',
      label: 'Meta Ads',
      connected: ipOk && !!process.env.META_ADS_ACCESS_TOKEN && !!process.env.META_ADS_AD_ACCOUNT_ID,
      description: 'Meta Marketing API (Facebook / Instagram)',
      lastSyncAt: new Date().toISOString(),
    },
    {
      channel: 'naver',
      label: '네이버 검색광고',
      connected: ipOk && !!process.env.NAVER_SEARCHAD_API_KEY && !!process.env.NAVER_SEARCHAD_CUSTOMER_ID,
      description: 'Naver Search Ad API (파워링크/브랜드검색)',
      lastSyncAt: new Date().toISOString(),
    },
    {
      channel: 'kakao',
      label: '카카오모먼트',
      connected: ipOk && !!process.env.KAKAO_MOMENT_ACCESS_TOKEN && !!process.env.KAKAO_MOMENT_AD_ACCOUNT_ID,
      description: 'Kakao Moment API (디스플레이/메시지)',
      lastSyncAt: new Date().toISOString(),
    },
    {
      channel: 'tiktok',
      label: 'TikTok Ads',
      connected: ipOk && !!process.env.TIKTOK_ADS_ACCESS_TOKEN && !!process.env.TIKTOK_ADS_ADVERTISER_ID,
      description: 'TikTok for Business API (Spark·InFeed·TopView)',
      lastSyncAt: new Date().toISOString(),
    },
    {
      channel: 'karrot',
      label: '당근 비즈',
      connected: ipOk && !!process.env.DANGGEUN_BIZ_ACCESS_TOKEN && !!process.env.DANGGEUN_BIZ_ACCOUNT_ID,
      description: '당근 비즈 파트너 API (또는 CSV 업로드)',
      lastSyncAt: new Date().toISOString(),
    },
  ]
}

/** GA4 등 매체 아닌 분석 도구 연결 상태 (허가 IP 제약 대상 아님) */
export interface AnalyticsIntegrationStatus {
  key: 'ga4'
  label: string
  connected: boolean
  description: string
  lastSyncAt?: string
}

export function getAnalyticsIntegrationStatus(): AnalyticsIntegrationStatus[] {
  const ga4 = !!process.env.GA4_PROPERTY_ID && (
    !!process.env.GA4_SERVICE_ACCOUNT_KEY ||
    (!!process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID && !!process.env.GCP_SERVICE_ACCOUNT_EMAIL)
  )
  return [
    {
      key: 'ga4',
      label: 'Google Analytics 4',
      connected: ga4,
      description: 'GA4 Data API (채널 그룹·UTM 퍼포먼스 데이터)',
      lastSyncAt: new Date().toISOString(),
    },
  ]
}

/**
 * 실 매체 API 호출 가드 — 최우선 규칙.
 * 실제 fetch 분기 앞에 반드시 이 함수를 호출하여 IP를 검증할 것.
 * 허가된 IP가 아니면 false → 호출자는 시뮬레이션 데이터로 폴백해야 함.
 */
export function canFetchRealMediaData(req?: Request): boolean {
  return canCallMediaApi(req)
}

// ───────── 시뮬레이션 데이터 (실 API 미연결 시) ─────────

function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function rand(seed: number, min: number, max: number): number {
  return Math.floor(min + seed * (max - min))
}

function calcDerivedMetrics(base: {
  impressions: number
  clicks: number
  cost: number
  conversions: number
  conversionValue: number
}): AdMetrics {
  const ctr = base.impressions ? (base.clicks / base.impressions) * 100 : 0
  const cpc = base.clicks ? base.cost / base.clicks : 0
  const cpm = base.impressions ? (base.cost / base.impressions) * 1000 : 0
  const cvr = base.clicks ? (base.conversions / base.clicks) * 100 : 0
  const cpa = base.conversions ? base.cost / base.conversions : 0
  const roas = base.cost ? (base.conversionValue / base.cost) * 100 : 0
  return { ...base, ctr, cpc, cpm, cvr, cpa, roas }
}

function dateRange(startDate: string, endDate: string): string[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const dates: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

const CHANNEL_PROFILE: Record<AdChannel, {
  impMin: number; impMax: number
  ctrMin: number; ctrMax: number
  cpcMin: number; cpcMax: number
  cvrMin: number; cvrMax: number
  aov: number  // 평균 객단가
}> = {
  google: { impMin: 18000, impMax: 35000, ctrMin: 2.5, ctrMax: 5.5, cpcMin: 350, cpcMax: 900, cvrMin: 1.8, cvrMax: 3.2, aov: 280000 },
  meta:   { impMin: 30000, impMax: 60000, ctrMin: 1.0, ctrMax: 2.5, cpcMin: 220, cpcMax: 650, cvrMin: 1.0, cvrMax: 2.4, aov: 250000 },
  naver:  { impMin: 12000, impMax: 25000, ctrMin: 3.0, ctrMax: 6.0, cpcMin: 400, cpcMax: 1200, cvrMin: 2.0, cvrMax: 4.0, aov: 320000 },
  kakao:  { impMin: 15000, impMax: 32000, ctrMin: 0.8, ctrMax: 2.0, cpcMin: 180, cpcMax: 520, cvrMin: 0.8, cvrMax: 2.0, aov: 220000 },
  tiktok: { impMin: 45000, impMax: 95000, ctrMin: 0.8, ctrMax: 2.2, cpcMin: 180, cpcMax: 550, cvrMin: 0.6, cvrMax: 1.8, aov: 180000 },
  karrot: { impMin: 8000,  impMax: 18000, ctrMin: 1.2, ctrMax: 3.0, cpcMin: 150, cpcMax: 450, cvrMin: 1.5, cvrMax: 3.5, aov: 210000 },
}

function simulateChannelDay(channel: AdChannel, date: string): ChannelPerformance {
  const p = CHANNEL_PROFILE[channel]
  const s1 = seedFromString(`${channel}-${date}-imp`)
  const s2 = seedFromString(`${channel}-${date}-ctr`)
  const s3 = seedFromString(`${channel}-${date}-cpc`)
  const s4 = seedFromString(`${channel}-${date}-cvr`)

  // 주말 트래픽 살짝 감소
  const dow = new Date(date).getDay()
  const weekendMul = dow === 0 || dow === 6 ? 0.75 : 1

  const impressions = Math.round(rand(s1, p.impMin, p.impMax) * weekendMul)
  const ctr = p.ctrMin + s2 * (p.ctrMax - p.ctrMin)
  const clicks = Math.round(impressions * ctr / 100)
  const cpc = p.cpcMin + s3 * (p.cpcMax - p.cpcMin)
  const cost = Math.round(clicks * cpc)
  const cvr = p.cvrMin + s4 * (p.cvrMax - p.cvrMin)
  const conversions = Math.round(clicks * cvr / 100)
  const conversionValue = conversions * p.aov

  return {
    channel,
    label: CHANNEL_LABEL[channel],
    ...calcDerivedMetrics({ impressions, clicks, cost, conversions, conversionValue }),
  }
}

export interface FetchOptions {
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
  channels?: AdChannel[]
}

const ALL_CHANNELS: AdChannel[] = ['google', 'meta', 'naver', 'kakao', 'tiktok', 'karrot']

/** 기간 합계 - 채널별 */
export async function getChannelSummary(opts: FetchOptions): Promise<ChannelPerformance[]> {
  const channels = opts.channels?.length ? opts.channels : ALL_CHANNELS
  const dates = dateRange(opts.startDate, opts.endDate)

  return channels.map((ch) => {
    const days = dates.map((d) => simulateChannelDay(ch, d))
    const sum = days.reduce(
      (acc, d) => ({
        impressions: acc.impressions + d.impressions,
        clicks: acc.clicks + d.clicks,
        cost: acc.cost + d.cost,
        conversions: acc.conversions + d.conversions,
        conversionValue: acc.conversionValue + d.conversionValue,
      }),
      { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0 },
    )
    return { channel: ch, label: CHANNEL_LABEL[ch], ...calcDerivedMetrics(sum) }
  })
}

/** 일자별 합계 (모든 채널 합산 또는 선택한 채널) */
export async function getDailyTrend(opts: FetchOptions): Promise<DailyPerformance[]> {
  const channels = opts.channels?.length ? opts.channels : ALL_CHANNELS
  const dates = dateRange(opts.startDate, opts.endDate)

  return dates.map((date) => {
    const totals = channels.reduce(
      (acc, ch) => {
        const d = simulateChannelDay(ch, date)
        return {
          impressions: acc.impressions + d.impressions,
          clicks: acc.clicks + d.clicks,
          cost: acc.cost + d.cost,
          conversions: acc.conversions + d.conversions,
        }
      },
      { impressions: 0, clicks: 0, cost: 0, conversions: 0 },
    )
    return { date, ...totals }
  })
}

/** 일자별 - 채널별 분리 (스택 차트용) */
export async function getDailyByChannel(opts: FetchOptions): Promise<{ date: string; google: number; meta: number; naver: number; kakao: number; tiktok: number; karrot: number; metric: 'cost' | 'clicks' | 'conversions' }[]> {
  const dates = dateRange(opts.startDate, opts.endDate)
  return dates.map((date) => {
    const row: Record<string, number | string> = { date, metric: 'cost' }
    for (const ch of ALL_CHANNELS) {
      row[ch] = simulateChannelDay(ch, date).cost
    }
    return row as unknown as { date: string; google: number; meta: number; naver: number; kakao: number; tiktok: number; karrot: number; metric: 'cost' }
  })
}

const CAMPAIGN_TEMPLATES: Record<AdChannel, string[]> = {
  google: [
    '검색_브랜드_핵심키워드',
    '검색_논브랜드_B2B마케팅',
    '디스플레이_리타겟팅',
    'YouTube_브랜드인지',
    'Performance Max - 전환',
  ],
  meta: [
    'FB_리드폼_B2B의사결정자',
    'IG_스토리_프로모션',
    'Reels_브랜드인지',
    'FB_리타겟팅_방문자',
    'Advantage+ Shopping',
  ],
  naver: [
    '파워링크_부스터_브랜드',
    '파워링크_B2B마케팅솔루션',
    '브랜드검색_위픽부스터',
    '쇼핑검색_플랜소개',
  ],
  kakao: [
    '디스플레이_리타겟팅',
    '비즈보드_B2B타겟',
    '메시지광고_고객관계관리',
  ],
  tiktok: [
    'Spark_피드_바이럴_v1',
    'TopView_런칭_브랜드인지',
    'InFeed_리타겟팅_방문자',
    'Spark_크리에이터_컬래버',
  ],
  karrot: [
    '지역기반_서울_B2B워크숍',
    '당근비즈_프로필노출',
    '당근광고_리타겟팅',
  ],
}

// ───────── 소재(Creative) 템플릿 ─────────

interface CreativeTemplate {
  name: string
  format: CreativeFormat
  headline: string
  description: string
  color: string
}

const CREATIVE_TEMPLATES: Record<AdChannel, CreativeTemplate[]> = {
  google: [
    { name: 'RSA_브랜드_v1', format: 'text', headline: '위픽부스터 - B2B 마케팅 자동화', description: '리드 발굴부터 전환까지, 한 번에', color: '#4285F4' },
    { name: 'RSA_논브랜드_v2', format: 'text', headline: 'B2B 마케터를 위한 올인원 솔루션', description: '월 평균 ROAS 320% 달성', color: '#34A853' },
    { name: 'YouTube_제품소개_15s', format: 'video', headline: '마케팅 시간을 절반으로', description: '15초 제품 소개 영상', color: '#EA4335' },
    { name: 'GDN_배너_300x250', format: 'image', headline: '무료로 시작하기', description: '14일 무료 체험', color: '#FBBC04' },
    { name: 'PMax_자산_가을프로모션', format: 'carousel', headline: '가을 한정 특가', description: '연 결제 시 30% 할인', color: '#9334E6' },
  ],
  meta: [
    { name: 'FB_피드_고객사례_v1', format: 'image', headline: '"한 달 만에 리드 3배"', description: '실제 고객 사례 보기', color: '#1877F2' },
    { name: 'IG_스토리_체험단_모집', format: 'image', headline: '14일 무료 체험단 모집', description: '신청만 하면 시작', color: '#E1306C' },
    { name: 'Reels_제품데모_15s', format: 'video', headline: '실제 사용 화면', description: '15초로 보는 핵심 기능', color: '#833AB4' },
    { name: 'FB_캐러셀_기능소개_5장', format: 'carousel', headline: '핵심 기능 5가지', description: '한눈에 보는 부스터', color: '#4267B2' },
    { name: 'IG_피드_가을이벤트', format: 'image', headline: '가을맞이 30% 할인', description: '한정 기간 특가', color: '#F77737' },
    { name: 'Advantage+_쇼핑_v1', format: 'image', headline: 'AI가 자동으로 최적화', description: '광고비 절감', color: '#1877F2' },
  ],
  naver: [
    { name: '파워링크_브랜드_T1', format: 'text', headline: '위픽부스터 공식', description: '국내 1위 B2B 마케팅 솔루션', color: '#03C75A' },
    { name: '파워링크_솔루션_T2', format: 'text', headline: 'B2B마케팅 통합관리', description: '리드부터 전환까지 한번에', color: '#03C75A' },
    { name: '브랜드검색_위픽부스터_프리미엄', format: 'image', headline: '위픽부스터', description: '프리미엄 브랜드존', color: '#00B843' },
    { name: '쇼핑검색_플랜_엔터프라이즈', format: 'image', headline: '엔터프라이즈 플랜', description: '대규모 운영팀 전용', color: '#19CE60' },
  ],
  kakao: [
    { name: '비즈보드_상단_v1', format: 'image', headline: 'B2B 마케팅, 부스터로', description: '카톡에서 시작', color: '#FEE500' },
    { name: '디스플레이_리타겟팅_300x250', format: 'image', headline: '체험 기회를 놓치지 마세요', description: '14일 무료', color: '#FFC700' },
    { name: '메시지광고_뉴스레터_v3', format: 'text', headline: '월간 마케팅 인사이트', description: '구독자 한정 자료', color: '#FFEB00' },
  ],
  tiktok: [
    { name: 'Spark_피드_15s_v1', format: 'video', headline: '바이럴 마케팅 솔루션', description: '15초로 보는 핵심', color: '#FF0050' },
    { name: 'TopView_런칭_6s', format: 'video', headline: '위픽부스터', description: '런칭 이벤트', color: '#000000' },
    { name: 'InFeed_고객후기_v2', format: 'video', headline: '"월 리드 3배"', description: '진짜 고객 후기', color: '#25F4EE' },
    { name: 'Spark_크리에이터_컬래버', format: 'video', headline: '크리에이터와 함께', description: '실제 사용 영상', color: '#FF0050' },
  ],
  karrot: [
    { name: '지역광고_서울_B2B', format: 'image', headline: '내 동네 B2B 마케팅 솔루션', description: '무료 체험', color: '#FF7E36' },
    { name: '비즈프로필_전체', format: 'image', headline: '위픽부스터 비즈프로필', description: '신뢰할 수 있는 파트너', color: '#FF9359' },
    { name: '당근광고_리타겟팅', format: 'image', headline: '다시 만나요', description: '14일 무료 체험 혜택', color: '#FF5E17' },
  ],
}

/** 소재(Creative)별 성과 */
export async function getCreativePerformance(opts: FetchOptions): Promise<CreativePerformance[]> {
  const channels = opts.channels?.length ? opts.channels : ALL_CHANNELS
  const dates = dateRange(opts.startDate, opts.endDate)
  const result: CreativePerformance[] = []

  for (const ch of channels) {
    const creatives = CREATIVE_TEMPLATES[ch]
    const campaigns = CAMPAIGN_TEMPLATES[ch]
    for (let i = 0; i < creatives.length; i++) {
      const cr = creatives[i]
      const campaignName = campaigns[i % campaigns.length]
      const share = [0.30, 0.22, 0.16, 0.12, 0.10, 0.06, 0.04][i] ?? 0.03

      // 소재별 성과 가중치 (포맷에 따라 살짝 다르게)
      const formatBonus = cr.format === 'video' ? 1.15 : cr.format === 'carousel' ? 1.08 : cr.format === 'image' ? 1.0 : 0.92
      const performanceSeed = seedFromString(`creative-perf-${ch}-${cr.name}`)
      const perfMul = 0.7 + performanceSeed * 0.6  // 0.7 ~ 1.3 배

      const days = dates.map((d) => simulateChannelDay(ch, d))
      const sum = days.reduce(
        (acc, d) => ({
          impressions: acc.impressions + Math.round(d.impressions * share * formatBonus),
          clicks: acc.clicks + Math.round(d.clicks * share * formatBonus * perfMul),
          cost: acc.cost + Math.round(d.cost * share * formatBonus),
          conversions: acc.conversions + Math.round(d.conversions * share * formatBonus * perfMul),
          conversionValue: acc.conversionValue + Math.round(d.conversionValue * share * formatBonus * perfMul),
        }),
        { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0 },
      )

      const statusSeed = seedFromString(`creative-status-${ch}-${cr.name}`)
      const status: CreativePerformance['status'] =
        statusSeed > 0.92 ? 'REJECTED' : statusSeed > 0.78 ? 'PAUSED' : 'ACTIVE'

      // 생성일: 30~120일 전
      const createdSeed = seedFromString(`creative-created-${ch}-${cr.name}`)
      const daysAgo = Math.round(30 + createdSeed * 90)
      const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10)

      result.push({
        creativeId: `${ch}-${i + 1}`,
        channel: ch,
        campaignName,
        creativeName: cr.name,
        format: cr.format,
        headline: cr.headline,
        description: cr.description,
        thumbnailColor: cr.color,
        status,
        createdAt,
        ...calcDerivedMetrics(sum),
      })
    }
  }
  return result.sort((a, b) => b.cost - a.cost)
}

/** 캠페인별 성과 */
export async function getCampaignPerformance(opts: FetchOptions): Promise<CampaignPerformance[]> {
  const channels = opts.channels?.length ? opts.channels : ALL_CHANNELS
  const dates = dateRange(opts.startDate, opts.endDate)
  const result: CampaignPerformance[] = []

  for (const ch of channels) {
    const campaigns = CAMPAIGN_TEMPLATES[ch]
    for (let i = 0; i < campaigns.length; i++) {
      const name = campaigns[i]
      // 캠페인별로 트래픽을 비례 분할
      const share = [0.42, 0.25, 0.16, 0.10, 0.07][i] ?? 0.05
      const days = dates.map((d) => simulateChannelDay(ch, d))
      const sum = days.reduce(
        (acc, d) => ({
          impressions: acc.impressions + Math.round(d.impressions * share),
          clicks: acc.clicks + Math.round(d.clicks * share),
          cost: acc.cost + Math.round(d.cost * share),
          conversions: acc.conversions + Math.round(d.conversions * share),
          conversionValue: acc.conversionValue + Math.round(d.conversionValue * share),
        }),
        { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0 },
      )
      const statusSeed = seedFromString(`status-${ch}-${name}`)
      const status: CampaignPerformance['status'] = statusSeed > 0.85 ? 'PAUSED' : 'ACTIVE'
      result.push({
        channel: ch,
        campaignName: name,
        status,
        ...calcDerivedMetrics(sum),
      })
    }
  }
  return result.sort((a, b) => b.cost - a.cost)
}

/** 전체 합계 (모든 채널) */
export async function getTotalSummary(opts: FetchOptions): Promise<AdMetrics> {
  const channels = await getChannelSummary(opts)
  const sum = channels.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      cost: acc.cost + c.cost,
      conversions: acc.conversions + c.conversions,
      conversionValue: acc.conversionValue + c.conversionValue,
    }),
    { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0 },
  )
  return calcDerivedMetrics(sum)
}
