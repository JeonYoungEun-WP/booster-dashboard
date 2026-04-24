/**
 * 이벤트 분석 데이터 → 멀티시트 Excel (.xlsx) 생성
 *
 * 시트 구성:
 *   1. 요약       — 광고비·리드·예약·계약·매출·ROAS 등 KPI
 *   2. 채널별     — Meta·TikTok 등 풀 퍼널
 *   3. 광고세트   — 트래킹코드 단위 상세
 *   4. 일자별     — 리드·예약 일자 분포
 *   5. GA4 소스   — 소스/매체/캠페인 전환 기여도
 *   6. 메타데이터 — 이벤트 ID · 기간 · 광고주 · 데이터 출처
 */

import * as XLSX from 'xlsx'
import type { EventAnalyticsResponse } from './event-analytics-service'

const CHANNEL_KO: Record<string, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  naver: 'Naver 검색광고',
  kakao: 'Kakao Moment',
  karrot: '당근 비즈',
}

function fmtKRW(n: number): string {
  return '₩' + Math.round(n).toLocaleString('ko-KR')
}

export interface XlsxBuildOptions {
  data: EventAnalyticsResponse
  generatedAt?: string
}

export function buildReportXlsx({ data, generatedAt = new Date().toISOString() }: XlsxBuildOptions): Blob {
  const wb = XLSX.utils.book_new()
  const f = data.funnel
  const advertiser = data.realDataNote?.advertiser ?? `이벤트 ${data.eventId}`
  const periodLabel = `${data.period.startDate} ~ ${data.period.endDate}`

  // ─── Sheet 1: 요약 ───
  const is3550 = data.eventId === '3550'
  const reserveLabel = is3550 ? '예약' : '방문예약'
  const contractLabel = is3550 ? '계약' : '결제'

  const summaryRows: Array<(string | number)[]> = [
    ['이벤트 ID', data.eventId],
    ['광고주', advertiser],
    ['기간', periodLabel],
    ['생성일', generatedAt.slice(0, 10)],
    [],
    ['─── 퍼널 수치 ───', ''],
    ['노출', f.impressions],
    ['클릭', f.clicks],
    ['세션', f.sessions],
    ['페이지뷰', f.pageViews],
    ['리드', f.leads],
    [reserveLabel, f.visitReservations],
    [contractLabel, f.reservations],
    [],
    ['─── 매출·ROAS ───', ''],
    ['광고비', f.adSpend],
    ['객단가 (추정)', f.averageOrderValue],
    ['매출 (추정)', f.reservationRevenue],
    ['ROAS', `${(f.trueROAS_estimated * 100).toFixed(2)}%`],
    [],
    ['─── 효율 지표 ───', ''],
    ['CTR (클릭 ÷ 노출)', `${f.ctr.toFixed(2)}%`],
    ['CPC (광고비 ÷ 클릭)', Math.round(f.cpc)],
    ['CPA · 리드 획득당', Math.round(f.cpa_lead)],
    [`${reserveLabel}당 단가`, Math.round(f.cpa_visitReservation)],
    [`${contractLabel}당 단가`, Math.round(f.cpa_reservation)],
    [],
    ['─── 단계별 전환율 ───', ''],
    ['클릭 → 리드', `${(f.cvr_session_to_lead * 100).toFixed(2)}%`],
    [`리드 → ${reserveLabel}`, `${(f.cvr_lead_to_visitReservation * 100).toFixed(2)}%`],
    [`${reserveLabel} → ${contractLabel}`, `${(f.cvr_visitReservation_to_payment * 100).toFixed(2)}%`],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet([
    ['항목', '값'],
    ...summaryRows,
  ])
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, '요약')

  // ─── Sheet 2: 채널별 ───
  const channels = [...data.byChannel].sort((a, b) => b.leads - a.leads)
  const channelRows: Array<(string | number)[]> = [
    ['채널', '광고비', '노출', '클릭', '리드', reserveLabel, contractLabel, '매출', 'CPA(리드)', `CPA(${reserveLabel})`, `CPA(${contractLabel})`, 'ROAS'],
    ...channels.map((c) => [
      CHANNEL_KO[c.channel] ?? c.channel,
      c.adSpend,
      c.impressions,
      c.clicks,
      c.leads,
      c.reservations,
      c.contracts,
      c.revenue,
      Math.round(c.cpa_lead),
      Math.round(c.cpa_reservation),
      Math.round(c.cpa_contract),
      `${(c.roas * 100).toFixed(2)}%`,
    ]),
    // 합계 행
    (() => {
      const sum = channels.reduce((acc, c) => ({
        adSpend: acc.adSpend + c.adSpend,
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        leads: acc.leads + c.leads,
        reservations: acc.reservations + c.reservations,
        contracts: acc.contracts + c.contracts,
        revenue: acc.revenue + c.revenue,
      }), { adSpend: 0, impressions: 0, clicks: 0, leads: 0, reservations: 0, contracts: 0, revenue: 0 })
      const totalRoas = sum.adSpend > 0 ? sum.revenue / sum.adSpend : 0
      return [
        '합계',
        sum.adSpend, sum.impressions, sum.clicks, sum.leads,
        sum.reservations, sum.contracts, sum.revenue,
        sum.leads > 0 ? Math.round(sum.adSpend / sum.leads) : 0,
        sum.reservations > 0 ? Math.round(sum.adSpend / sum.reservations) : 0,
        sum.contracts > 0 ? Math.round(sum.adSpend / sum.contracts) : 0,
        `${(totalRoas * 100).toFixed(2)}%`,
      ]
    })(),
  ]
  const wsChannel = XLSX.utils.aoa_to_sheet(channelRows)
  wsChannel['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
    { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(wb, wsChannel, '채널별')

  // ─── Sheet 3: 광고세트 (트래킹코드) ───
  const codes = data.byTrackingCode
  const codeRows: Array<(string | number)[]> = [
    ['트래킹코드', '광고비', '노출', '클릭', '리드', reserveLabel, 'CPA(리드)', `${reserveLabel}당 단가`, 'ROAS'],
    ...codes.map((c) => [
      c.trackingCode,
      c.adSpend,
      c.impressions,
      c.clicks,
      c.leads,
      c.reservations,
      c.cpa_lead > 0 ? Math.round(c.cpa_lead) : '—',
      c.costPerReservation > 0 ? Math.round(c.costPerReservation) : '—',
      `${(c.reservationROAS * 100).toFixed(2)}%`,
    ]),
    // 합계
    (() => {
      const sum = codes.reduce((acc, c) => ({
        adSpend: acc.adSpend + c.adSpend,
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        leads: acc.leads + c.leads,
        reservations: acc.reservations + c.reservations,
      }), { adSpend: 0, impressions: 0, clicks: 0, leads: 0, reservations: 0 })
      const totalRoasNum = codes.reduce((s, c) => s + c.reservationROAS * c.adSpend, 0)
      const totalRoas = sum.adSpend > 0 ? totalRoasNum / sum.adSpend : 0
      return [
        '합계',
        sum.adSpend, sum.impressions, sum.clicks, sum.leads, sum.reservations,
        sum.leads > 0 ? Math.round(sum.adSpend / sum.leads) : 0,
        sum.reservations > 0 ? Math.round(sum.adSpend / sum.reservations) : 0,
        `${(totalRoas * 100).toFixed(2)}%`,
      ]
    })(),
  ]
  const wsCode = XLSX.utils.aoa_to_sheet(codeRows)
  wsCode['!cols'] = [
    { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
    { wch: 12 }, { wch: 14 }, { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(wb, wsCode, '광고세트')

  // ─── Sheet 4: 일자별 ───
  const leadsSection = data.leads as { byDate?: Array<{ date: string; leads: number; reservations: number }> } | null
  const ga4Section = data.ga4 as { daily?: Array<{ date: string; sessions: number; activeUsers: number; conversions: number }> } | null

  const byDate = leadsSection?.byDate ?? []
  const ga4Daily = ga4Section?.daily ?? []
  const ga4Map = new Map(ga4Daily.map((d) => [d.date, d]))

  if (byDate.length > 0 || ga4Daily.length > 0) {
    const allDates = new Set<string>([...byDate.map((d) => d.date), ...ga4Daily.map((d) => d.date)])
    const dailyRows: Array<(string | number)[]> = [
      ['날짜', '세션', '활성 사용자', 'GA4 전환', '리드', reserveLabel],
      ...Array.from(allDates).sort().map((date) => {
        const l = byDate.find((x) => x.date === date)
        const g = ga4Map.get(date)
        return [
          date,
          g?.sessions ?? 0,
          g?.activeUsers ?? 0,
          g?.conversions ?? 0,
          l?.leads ?? 0,
          l?.reservations ?? 0,
        ]
      }),
    ]
    const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows)
    wsDaily['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wb, wsDaily, '일자별')
  }

  // ─── Sheet 5: GA4 소스 ───
  const ga4Section2 = data.ga4 as {
    bySource?: Array<{ source: string; medium: string; campaign: string; sessions: number; conversions: number }>
  } | null
  const sources = ga4Section2?.bySource ?? []
  if (sources.length > 0) {
    const srcRows: Array<(string | number)[]> = [
      ['Source', 'Medium', 'Campaign', 'Sessions', 'Conversions'],
      ...sources.map((s) => [s.source, s.medium, s.campaign, s.sessions, s.conversions]),
    ]
    const wsSrc = XLSX.utils.aoa_to_sheet(srcRows)
    wsSrc['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 48 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsSrc, 'GA4 소스')
  }

  // ─── Sheet 6: 메타데이터 ───
  const ga4Meta = data.ga4 as { simulated?: boolean; unavailable?: boolean; error?: string } | null
  const leadsMeta = data.leads as { simulated?: boolean } | null
  const clarityMeta = data.clarity as { unavailable?: boolean; error?: string } | null

  const metaRows: Array<(string | number)[]> = [
    ['항목', '값'],
    ['이벤트 ID', data.eventId],
    ['광고주', advertiser],
    ['기간', periodLabel],
    ['생성일', generatedAt],
    [],
    ['─── 랜딩 URL 후보 ───', ''],
    ...data.landingPaths.map((p, i): (string | number)[] => [`URL ${i + 1}`, `heypick.co.kr${p}`]),
  ]
  // suppress unused-var warnings (유지: 추후 내부 디버그용 가능성)
  void ga4Meta; void leadsMeta; void clarityMeta;
  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows)
  wsMeta['!cols'] = [{ wch: 22 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsMeta, '메타')

  // 브라우저 Blob 변환
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
