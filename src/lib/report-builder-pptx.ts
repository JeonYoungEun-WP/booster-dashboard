/**
 * 이벤트 분석 데이터 → 편집 가능 PPT (.pptx) 생성
 *
 * 브랜드: boosterMAX
 * 폰트:   Pretendard (사용자 PC 에 설치돼 있어야 제대로 표시, 없으면 PowerPoint 기본 폰트)
 *
 * 사용처: ReportModeDialog — 사용자 클릭 시 브라우저에서 생성·다운로드.
 * pptxgenjs 는 브라우저·Node 모두 지원.
 */

import PptxGenJS from 'pptxgenjs'
import type { EventAnalyticsResponse } from './event-analytics-service'

// ───── 브랜드 / 컬러 토큰 ─────
const BRAND_NAME = 'boosterMAX'
const BRAND_FONT = 'Pretendard'
const COLOR_BRAND = '8B5CF6'          // violet-500
const COLOR_BRAND_DARK = '6D28D9'     // violet-700
const COLOR_TEXT_DARK = '171819'
const COLOR_TEXT_MUTED = '868E96'
const COLOR_BORDER = 'E5E8EB'
const COLOR_BG_LIGHT = 'F5F6F8'
const COLOR_SUCCESS = '10B981'
const COLOR_WARN = 'F59E0B'

function fmtKRW(n: number): string {
  return '₩' + Math.round(n).toLocaleString('ko-KR')
}
function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`
}

// 채널 한글명 매핑 (CHANNEL_LABEL import 쓰려 했으나 번들 사이즈 고려 간단 매핑)
const CHANNEL_KO: Record<string, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  naver: 'Naver 검색광고',
  kakao: 'Kakao Moment',
  karrot: '당근 비즈',
}

const STATUS_COLOR = COLOR_BRAND
const SLIDE_W = 13.33
const SLIDE_H = 7.5

/** 슬라이드 공통 푸터 */
function addFooter(slide: PptxGenJS.Slide, pageNum: number, totalPages: number, periodLabel: string) {
  slide.addShape('line', {
    x: 0.5, y: SLIDE_H - 0.55, w: SLIDE_W - 1, h: 0,
    line: { color: COLOR_BORDER, width: 0.75 },
  })
  slide.addText(`${BRAND_NAME} · ${periodLabel}`, {
    x: 0.5, y: SLIDE_H - 0.45, w: 6, h: 0.3,
    fontFace: BRAND_FONT, fontSize: 10, color: COLOR_TEXT_MUTED,
  })
  slide.addText(`${pageNum} / ${totalPages}`, {
    x: SLIDE_W - 2, y: SLIDE_H - 0.45, w: 1.5, h: 0.3,
    align: 'right', fontFace: BRAND_FONT, fontSize: 10, color: COLOR_TEXT_MUTED,
  })
}

/** 슬라이드 제목 바 */
function addTitle(slide: PptxGenJS.Slide, title: string, subtitle?: string) {
  slide.addText(title, {
    x: 0.5, y: 0.35, w: SLIDE_W - 1, h: 0.6,
    fontFace: BRAND_FONT, fontSize: 26, bold: true, color: COLOR_TEXT_DARK,
  })
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 1.0, w: SLIDE_W - 1, h: 0.35,
      fontFace: BRAND_FONT, fontSize: 13, color: COLOR_TEXT_MUTED,
    })
  }
  slide.addShape('line', {
    x: 0.5, y: 1.45, w: SLIDE_W - 1, h: 0,
    line: { color: COLOR_BORDER, width: 1 },
  })
}

/** KPI 타일 추가 */
function addKpiTile(
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
  label: string, value: string, sub?: string, accent?: string,
) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: 'FFFFFF' },
    line: { color: COLOR_BORDER, width: 1 },
    rectRadius: 0.08,
  })
  slide.addText(label, {
    x: x + 0.15, y: y + 0.12, w: w - 0.3, h: 0.3,
    fontFace: BRAND_FONT, fontSize: 10, color: COLOR_TEXT_MUTED,
  })
  slide.addText(value, {
    x: x + 0.15, y: y + 0.42, w: w - 0.3, h: h - 0.7,
    fontFace: BRAND_FONT, fontSize: 24, bold: true,
    color: accent ?? COLOR_TEXT_DARK,
  })
  if (sub) {
    slide.addText(sub, {
      x: x + 0.15, y: y + h - 0.35, w: w - 0.3, h: 0.3,
      fontFace: BRAND_FONT, fontSize: 9, color: COLOR_TEXT_MUTED,
    })
  }
}

// ───── 슬라이드 생성기 ─────

export interface ReportBuildOptions {
  data: EventAnalyticsResponse
  generatedAt?: string   // ISO, default: now
  title?: string         // 표지 타이틀 커스터마이즈
}

export async function buildReportPptx({
  data,
  generatedAt = new Date().toISOString(),
  title,
}: ReportBuildOptions): Promise<Blob> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = BRAND_NAME
  pptx.company = BRAND_NAME
  pptx.title = title ?? `${data.realDataNote?.advertiser ?? '이벤트 ' + data.eventId} · 성과 리포트`
  pptx.subject = `booster analytics report · event ${data.eventId}`

  const advertiser = data.realDataNote?.advertiser ?? `이벤트 ${data.eventId}`
  const periodLabel = `${data.period.startDate} ~ ${data.period.endDate}`
  const totalPagesPlaceholder = 8

  const f = data.funnel

  // ═════════ 슬라이드 1 — 표지 ═════════
  {
    const slide = pptx.addSlide()
    slide.background = { color: COLOR_BRAND }

    // 브랜드 마크 placeholder (로고 나중 삽입)
    slide.addText(BRAND_NAME, {
      x: 0.7, y: 0.6, w: 4, h: 0.5,
      fontFace: BRAND_FONT, fontSize: 16, color: 'FFFFFF', bold: true,
    })

    // 메인 타이틀
    slide.addText(`${advertiser}`, {
      x: 0.7, y: 2.5, w: SLIDE_W - 1.4, h: 1.0,
      fontFace: BRAND_FONT, fontSize: 44, bold: true, color: 'FFFFFF',
    })
    slide.addText('랜딩페이지 성과 리포트', {
      x: 0.7, y: 3.5, w: SLIDE_W - 1.4, h: 0.6,
      fontFace: BRAND_FONT, fontSize: 22, color: 'FFFFFF',
    })

    // 기간 배지
    slide.addShape('roundRect', {
      x: 0.7, y: 4.5, w: 5, h: 0.6,
      fill: { color: 'FFFFFF', transparency: 85 },
      line: { color: 'FFFFFF', width: 0 },
      rectRadius: 0.3,
    })
    slide.addText(`기간  ${periodLabel}`, {
      x: 0.7, y: 4.5, w: 5, h: 0.6,
      align: 'center', valign: 'middle',
      fontFace: BRAND_FONT, fontSize: 14, color: 'FFFFFF', bold: true,
    })

    // 푸터 (하단)
    slide.addText(`생성일: ${generatedAt.slice(0, 10)}`, {
      x: 0.7, y: SLIDE_H - 0.8, w: 6, h: 0.3,
      fontFace: BRAND_FONT, fontSize: 11, color: 'FFFFFF', transparency: 30,
    })
    slide.addText(`이벤트 ID: ${data.eventId}`, {
      x: SLIDE_W - 4, y: SLIDE_H - 0.8, w: 3.3, h: 0.3,
      align: 'right',
      fontFace: BRAND_FONT, fontSize: 11, color: 'FFFFFF', transparency: 30,
    })
  }

  // ═════════ 슬라이드 2 — Executive Summary (KPI 그리드) ═════════
  {
    const slide = pptx.addSlide()
    addTitle(slide, '한눈에 보는 성과', `${advertiser} · ${periodLabel}`)

    // 2 x 3 KPI 그리드
    const tileW = 4.0
    const tileH = 1.6
    const gap = 0.2
    const startX = 0.5
    const startY = 1.8

    const kpis: Array<{ label: string; value: string; sub?: string; accent?: string }> = [
      { label: '광고비', value: fmtKRW(f.adSpend) },
      { label: '리드', value: fmtNumber(f.leads), sub: '폼 제출 완료' },
      { label: '예약', value: fmtNumber(f.visitReservations), sub: '상담 완료' },
      { label: '계약 (결제)', value: fmtNumber(f.reservations), sub: '매출 발생', accent: COLOR_SUCCESS },
      { label: '매출 (추정)', value: fmtKRW(f.reservationRevenue), sub: `객단가 ${fmtKRW(f.averageOrderValue)}` },
      { label: 'ROAS', value: (f.trueROAS_estimated * 100).toFixed(1) + '%', sub: '매출 ÷ 광고비',
        accent: f.trueROAS_estimated >= 1 ? COLOR_SUCCESS : COLOR_WARN },
    ]

    kpis.forEach((kpi, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      addKpiTile(
        slide,
        startX + col * (tileW + gap),
        startY + row * (tileH + gap),
        tileW, tileH,
        kpi.label, kpi.value, kpi.sub, kpi.accent,
      )
    })

    // 하단 요약 문장
    const roasPct = (f.trueROAS_estimated * 100).toFixed(1)
    slide.addText(
      `광고비 ${fmtKRW(f.adSpend)} 투입으로 리드 ${fmtNumber(f.leads)}건, 최종 계약 ${fmtNumber(f.reservations)}건 확보 · ROAS ${roasPct}%`,
      {
        x: 0.5, y: 5.6, w: SLIDE_W - 1, h: 0.6,
        fontFace: BRAND_FONT, fontSize: 14, italic: true, color: COLOR_TEXT_DARK,
      },
    )

    addFooter(slide, 2, totalPagesPlaceholder, periodLabel)
  }

  // ═════════ 슬라이드 3 — 퍼널 흐름 ═════════
  {
    const slide = pptx.addSlide()
    addTitle(slide, '광고비 → 계약 퍼널', '단계별 수 · 전환율 · 획득당 비용')

    const stages = [
      { label: '노출',   value: f.impressions,       cvr: null,                      cpa: null },
      { label: '클릭',   value: f.clicks,            cvr: f.ctr / 100,               cpa: f.cpc },
      { label: '리드',   value: f.leads,             cvr: f.cvr_session_to_lead,     cpa: f.cpa_lead },
      { label: '예약',   value: f.visitReservations, cvr: f.cvr_lead_to_visitReservation, cpa: f.cpa_visitReservation },
      { label: '계약',   value: f.reservations,      cvr: f.cvr_visitReservation_to_payment, cpa: f.cpa_reservation },
    ]

    const topVal = stages[0].value || 1
    const rowH = 0.85
    const startY = 1.8
    const maxBarW = SLIDE_W - 3.5   // 왼쪽 라벨·값 공간 빼고 오른쪽 바

    stages.forEach((s, i) => {
      const y = startY + i * rowH
      // 라벨
      slide.addText(s.label, {
        x: 0.5, y, w: 1.3, h: rowH - 0.1,
        fontFace: BRAND_FONT, fontSize: 16, bold: true, color: COLOR_TEXT_DARK,
        valign: 'middle',
      })
      // 값
      slide.addText(fmtNumber(s.value), {
        x: 1.8, y, w: 1.5, h: rowH - 0.1,
        fontFace: BRAND_FONT, fontSize: 18, bold: true, color: COLOR_BRAND,
        valign: 'middle',
      })
      // 바 (log-scale 대신 linear)
      const barW = Math.max(0.3, (s.value / topVal) * maxBarW)
      slide.addShape('roundRect', {
        x: 3.3, y: y + 0.18, w: barW, h: rowH - 0.45,
        fill: { color: COLOR_BRAND, transparency: 80 - (i * 15) },
        line: { color: COLOR_BRAND, width: 0 },
        rectRadius: 0.05,
      })
      // 전환율·CPA (우측)
      if (s.cvr !== null) {
        slide.addText(`${fmtPct(s.cvr)} · ${fmtKRW(s.cpa ?? 0)}`, {
          x: SLIDE_W - 2.8, y, w: 2.3, h: rowH - 0.1,
          align: 'right', valign: 'middle',
          fontFace: BRAND_FONT, fontSize: 11, color: COLOR_TEXT_MUTED,
        })
      } else {
        slide.addText('시작', {
          x: SLIDE_W - 2.8, y, w: 2.3, h: rowH - 0.1,
          align: 'right', valign: 'middle',
          fontFace: BRAND_FONT, fontSize: 11, color: COLOR_TEXT_MUTED,
        })
      }
    })

    addFooter(slide, 3, totalPagesPlaceholder, periodLabel)
  }

  // ═════════ 슬라이드 4 — 채널별 성과 표 ═════════
  {
    const slide = pptx.addSlide()
    addTitle(slide, '채널별 성과', `${data.byChannel.length}개 채널 · 리드 내림차순`)

    const channelRows = [...data.byChannel].sort((a, b) => b.leads - a.leads)

    const tableData: PptxGenJS.TableRow[] = [
      [
        { text: '채널', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'left' } },
        { text: '광고비', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: '클릭', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: '리드', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: '예약', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: '계약', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: 'CPA(리드)', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: 'ROAS', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
      ],
      ...channelRows.map<PptxGenJS.TableRow>((c) => [
        { text: CHANNEL_KO[c.channel] ?? c.channel, options: { align: 'left' } },
        { text: fmtKRW(c.adSpend), options: { align: 'right' } },
        { text: fmtNumber(c.clicks), options: { align: 'right' } },
        { text: fmtNumber(c.leads), options: { align: 'right' } },
        { text: fmtNumber(c.reservations), options: { align: 'right' } },
        { text: fmtNumber(c.contracts), options: { align: 'right' } },
        { text: c.cpa_lead > 0 ? fmtKRW(c.cpa_lead) : '—', options: { align: 'right' } },
        {
          text: fmtPct(c.roas),
          options: {
            align: 'right',
            color: c.roas >= 1 ? COLOR_SUCCESS : COLOR_WARN,
            bold: true,
          },
        },
      ]),
    ]

    slide.addTable(tableData, {
      x: 0.5, y: 1.8, w: SLIDE_W - 1, colW: [2.0, 1.7, 1.3, 1.3, 1.3, 1.3, 1.7, 1.7],
      fontFace: BRAND_FONT, fontSize: 12,
      border: { type: 'solid', color: COLOR_BORDER, pt: 0.5 },
    })

    addFooter(slide, 4, totalPagesPlaceholder, periodLabel)
  }

  // ═════════ 슬라이드 5 — 트래킹코드 상세 (TOP 10) ═════════
  {
    const slide = pptx.addSlide()
    const codes = data.byTrackingCode.slice(0, 10)
    addTitle(slide, '광고세트별 성과', `트래킹코드 상위 ${codes.length}개 · 광고비 내림차순`)

    const tableData: PptxGenJS.TableRow[] = [
      [
        { text: '트래킹코드', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'left' } },
        { text: '광고비', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: '노출', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: '클릭', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: '리드', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: '예약', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: 'CPA', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        { text: 'ROAS', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
      ],
      ...codes.map<PptxGenJS.TableRow>((c) => [
        { text: c.trackingCode, options: { align: 'left', fontFace: 'Consolas', fontSize: 11 } },
        { text: fmtKRW(c.adSpend), options: { align: 'right' } },
        { text: fmtNumber(c.impressions), options: { align: 'right' } },
        { text: fmtNumber(c.clicks), options: { align: 'right' } },
        { text: fmtNumber(c.leads), options: { align: 'right' } },
        { text: fmtNumber(c.reservations), options: { align: 'right' } },
        { text: c.cpa_lead > 0 ? fmtKRW(c.cpa_lead) : '—', options: { align: 'right' } },
        {
          text: fmtPct(c.reservationROAS),
          options: {
            align: 'right',
            color: c.reservationROAS >= 1 ? COLOR_SUCCESS : COLOR_WARN,
            bold: true,
          },
        },
      ]),
    ]

    slide.addTable(tableData, {
      x: 0.3, y: 1.8, w: SLIDE_W - 0.6, colW: [2.3, 1.5, 1.3, 1.3, 1.3, 1.3, 1.5, 1.2],
      fontFace: BRAND_FONT, fontSize: 11,
      border: { type: 'solid', color: COLOR_BORDER, pt: 0.5 },
    })

    addFooter(slide, 5, totalPagesPlaceholder, periodLabel)
  }

  // ═════════ 슬라이드 6 — 일자별 추이 (native chart) ═════════
  {
    const slide = pptx.addSlide()
    addTitle(slide, '일자별 추이', '세션·리드·예약 일자별 분포')

    const leadsSection = data.leads as { byDate?: Array<{ date: string; leads: number; reservations: number }> } | null
    const ga4Section = data.ga4 as { daily?: Array<{ date: string; sessions: number }> } | null

    const byDate = leadsSection?.byDate ?? []
    const ga4Daily = ga4Section?.daily ?? []

    if (byDate.length > 0) {
      const labels = byDate.map((d) => d.date.slice(5))
      const leadsVals = byDate.map((d) => d.leads)
      const reservationsVals = byDate.map((d) => d.reservations)
      const sessionsMap = new Map(ga4Daily.map((d) => [d.date, d.sessions]))
      const sessionsVals = byDate.map((d) => sessionsMap.get(d.date) ?? 0)

      slide.addChart(pptx.ChartType.bar, [
        { name: '리드', labels, values: leadsVals },
        { name: '예약', labels, values: reservationsVals },
        { name: '세션', labels, values: sessionsVals },
      ], {
        x: 0.5, y: 1.8, w: SLIDE_W - 1, h: 5,
        barDir: 'col',
        barGrouping: 'clustered',
        chartColors: [COLOR_WARN, COLOR_SUCCESS, COLOR_BRAND],
        showLegend: true,
        legendPos: 'b',
        catAxisLabelFontSize: 10,
        valAxisLabelFontSize: 10,
        dataLabelFontSize: 8,
      })
    } else {
      slide.addText('일자별 데이터 없음', {
        x: 0.5, y: 3, w: SLIDE_W - 1, h: 1,
        align: 'center',
        fontFace: BRAND_FONT, fontSize: 14, color: COLOR_TEXT_MUTED,
      })
    }

    addFooter(slide, 6, totalPagesPlaceholder, periodLabel)
  }

  // ═════════ 슬라이드 7 — GA4 소스·매체 ═════════
  {
    const slide = pptx.addSlide()
    addTitle(slide, 'GA4 유입 경로', '소스 · 매체 · 캠페인 (상위 12)')

    const ga4 = data.ga4 as {
      bySource?: Array<{ source: string; medium: string; campaign: string; sessions: number; conversions: number }>
      unavailable?: boolean
      error?: string
    } | null

    if (ga4?.bySource && ga4.bySource.length > 0) {
      const sources = ga4.bySource.slice(0, 12)
      const tableData: PptxGenJS.TableRow[] = [
        [
          { text: 'Source', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'left' } },
          { text: 'Medium', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'left' } },
          { text: 'Campaign', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'left' } },
          { text: 'Sessions', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
          { text: 'Conversions', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'right' } },
        ],
        ...sources.map<PptxGenJS.TableRow>((s) => [
          { text: s.source, options: { align: 'left' } },
          { text: s.medium, options: { align: 'left', color: COLOR_TEXT_MUTED } },
          { text: s.campaign.length > 40 ? s.campaign.slice(0, 38) + '…' : s.campaign, options: { align: 'left', fontSize: 10 } },
          { text: fmtNumber(s.sessions), options: { align: 'right' } },
          { text: fmtNumber(s.conversions), options: { align: 'right' } },
        ]),
      ]
      slide.addTable(tableData, {
        x: 0.3, y: 1.8, w: SLIDE_W - 0.6, colW: [2.2, 1.8, 5.8, 1.3, 1.5],
        fontFace: BRAND_FONT, fontSize: 11,
        border: { type: 'solid', color: COLOR_BORDER, pt: 0.5 },
      })
    } else {
      slide.addText(
        ga4?.unavailable ? 'GA4 미연결 — 자격증명 셋업 필요' :
        ga4?.error ? `GA4 에러: ${ga4.error}` :
        'GA4 소스 데이터 없음',
        {
          x: 0.5, y: 3, w: SLIDE_W - 1, h: 1,
          align: 'center',
          fontFace: BRAND_FONT, fontSize: 14, color: COLOR_TEXT_MUTED,
        },
      )
    }

    addFooter(slide, 7, totalPagesPlaceholder, periodLabel)
  }

  // ═════════ 슬라이드 8 — 액션 아이템 (편집 가능 placeholder) ═════════
  {
    const slide = pptx.addSlide()
    addTitle(slide, '결론 & 액션 아이템', `${advertiser} 다음 단계 제안`)

    // 데이터 기반 자동 인사이트 (가벼운 규칙 기반)
    const channelRows = [...data.byChannel].sort((a, b) => b.roas - a.roas)
    const topChannel = channelRows[0]
    const topCode = data.byTrackingCode[0]

    const roasPct = (f.trueROAS_estimated * 100).toFixed(1)
    const roasJudge = f.trueROAS_estimated >= 1 ? '효율 확보 중' : '추가 최적화 필요'

    const bullets = [
      `ROAS ${roasPct}% — ${roasJudge}`,
      topChannel
        ? `최고 채널: ${CHANNEL_KO[topChannel.channel] ?? topChannel.channel} (ROAS ${fmtPct(topChannel.roas)}) → 예산 비중 확대 고려`
        : '채널별 비교 데이터 없음',
      topCode
        ? `최고 광고세트: ${topCode.trackingCode} — 광고비 ${fmtKRW(topCode.adSpend)} / ROAS ${fmtPct(topCode.reservationROAS)}`
        : '광고세트 데이터 없음',
      `리드 → 예약 전환율 ${fmtPct(f.cvr_lead_to_visitReservation)} · 예약 → 계약 전환율 ${fmtPct(f.cvr_visitReservation_to_payment)}`,
      '[편집] 다음 스프린트 구체 액션 3개를 여기에 기재하세요.',
      '[편집] 리스크·가설 검증 항목을 여기에 기재하세요.',
    ]

    bullets.forEach((text, i) => {
      slide.addText([
        { text: '• ', options: { color: COLOR_BRAND, bold: true } },
        { text, options: {} },
      ], {
        x: 0.7, y: 1.9 + i * 0.65, w: SLIDE_W - 1.4, h: 0.55,
        fontFace: BRAND_FONT, fontSize: 14, color: COLOR_TEXT_DARK,
      })
    })

    // 하단 브랜드 마크
    slide.addText(`${BRAND_NAME} 성과 리포트`, {
      x: 0.5, y: SLIDE_H - 1.0, w: SLIDE_W - 1, h: 0.4,
      align: 'center',
      fontFace: BRAND_FONT, fontSize: 11, color: COLOR_TEXT_MUTED,
    })

    addFooter(slide, 8, totalPagesPlaceholder, periodLabel)
  }

  // Blob 으로 반환 (브라우저 저장 용이)
  const blob = await pptx.write({ outputType: 'blob' })
  return blob as Blob
}

/** 브라우저 다운로드 트리거 */
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

// STATUS_COLOR unused — reserved for future
void STATUS_COLOR
