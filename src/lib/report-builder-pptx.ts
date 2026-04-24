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

  // ═════════ 슬라이드 3 — 퍼널 5 카드 (대시보드 FunnelFlow 스타일) ═════════
  {
    const slide = pptx.addSlide()
    addTitle(slide, '풀퍼널 분석', '단계별 수 · 전환율 · 획득당 비용')

    const is3550 = data.eventId === '3550'
    const reserveLabel = is3550 ? '예약' : '방문예약'
    const contractLabel = is3550 ? '계약' : '결제'

    const stages = [
      { label: '노출', value: f.impressions, prevLabel: null, cvr: null as number | null, cpu: null as number | null, cpuLabel: '' },
      { label: '클릭', value: f.clicks, prevLabel: '노출', cvr: f.ctr / 100, cpu: f.cpc, cpuLabel: 'CPC · 클릭당' },
      { label: '리드', value: f.leads, prevLabel: '클릭', cvr: f.clicks > 0 ? f.leads / f.clicks : 0, cpu: f.cpa_lead, cpuLabel: 'CPA · 리드 획득당' },
      { label: reserveLabel, value: f.visitReservations, prevLabel: '리드', cvr: f.cvr_lead_to_visitReservation, cpu: f.cpa_visitReservation, cpuLabel: `${reserveLabel}당 단가` },
      { label: contractLabel, value: f.reservations, prevLabel: reserveLabel, cvr: f.cvr_visitReservation_to_payment, cpu: f.cpa_reservation, cpuLabel: `${contractLabel}당 단가` },
    ]

    // 5 카드 그리드 상단부
    const cardTop = 1.7
    const cardW = (SLIDE_W - 1 - 4 * 0.15) / 5   // 전체 너비 / 5 카드
    const cardH = 2.4

    stages.forEach((s, i) => {
      const x = 0.5 + i * (cardW + 0.15)
      // 카드 배경
      slide.addShape('roundRect', {
        x, y: cardTop, w: cardW, h: cardH,
        fill: { color: 'FFFFFF' },
        line: { color: COLOR_BORDER, width: 1.5 },
        rectRadius: 0.12,
      })
      // 라벨
      slide.addText(s.label, {
        x: x + 0.15, y: cardTop + 0.12, w: cardW - 0.3, h: 0.3,
        fontFace: BRAND_FONT, fontSize: 12, color: COLOR_TEXT_MUTED,
      })
      // 값
      slide.addText(fmtNumber(s.value), {
        x: x + 0.15, y: cardTop + 0.45, w: cardW - 0.3, h: 0.9,
        fontFace: BRAND_FONT, fontSize: 30, bold: true, color: COLOR_TEXT_DARK,
      })
      // 전환율
      if (s.cvr !== null) {
        const convGood = s.cvr >= 0.5
        slide.addText([
          { text: `${s.prevLabel} → `, options: { color: COLOR_TEXT_MUTED } },
          { text: fmtPct(s.cvr), options: { color: convGood ? COLOR_SUCCESS : 'E11D48', bold: true } },
        ], {
          x: x + 0.15, y: cardTop + 1.25, w: cardW - 0.3, h: 0.3,
          fontFace: BRAND_FONT, fontSize: 11,
        })
      } else {
        slide.addText('시작', {
          x: x + 0.15, y: cardTop + 1.25, w: cardW - 0.3, h: 0.3,
          fontFace: BRAND_FONT, fontSize: 11, color: COLOR_TEXT_MUTED,
        })
      }
      // CPU (획득당 비용) — 하단 분리 영역
      if (s.cpu !== null && s.cpu > 0) {
        slide.addShape('line', {
          x: x + 0.15, y: cardTop + 1.65, w: cardW - 0.3, h: 0,
          line: { color: COLOR_BORDER, width: 0.5 },
        })
        slide.addText(s.cpuLabel, {
          x: x + 0.15, y: cardTop + 1.7, w: cardW - 0.3, h: 0.25,
          fontFace: BRAND_FONT, fontSize: 9, color: COLOR_TEXT_MUTED,
        })
        slide.addText(fmtKRW(s.cpu), {
          x: x + 0.15, y: cardTop + 1.95, w: cardW - 0.3, h: 0.35,
          fontFace: BRAND_FONT, fontSize: 15, bold: true, color: COLOR_TEXT_DARK,
        })
      }
    })

    // 하단 요약 4 카드 (광고비 / 객단가 / 매출 / ROAS)
    const bottomY = 4.5
    const bottomW = (SLIDE_W - 1 - 3 * 0.15) / 4
    const bottomH = 1.2
    const bottomCards: Array<{ label: string; value: string; bg: string; fg: string; border: string }> = [
      { label: '광고비', value: fmtKRW(f.adSpend), bg: 'F8FAFC', fg: COLOR_TEXT_DARK, border: 'E2E8F0' },
      { label: '객단가 (추정)', value: fmtKRW(f.averageOrderValue), bg: 'ECFDF533', fg: '047857', border: 'BBF7D0' },
      { label: '매출 (추정)', value: fmtKRW(f.reservationRevenue), bg: 'ECFDF5', fg: '065F46', border: '86EFAC' },
      { label: 'ROAS', value: (f.trueROAS_estimated * 100).toFixed(1) + '%',
        bg: f.trueROAS_estimated >= 1 ? 'D1FAE5' : 'FEF3C7',
        fg: f.trueROAS_estimated >= 1 ? '047857' : 'B45309',
        border: f.trueROAS_estimated >= 1 ? '6EE7B7' : 'FDE68A' },
    ]
    bottomCards.forEach((c, i) => {
      const x = 0.5 + i * (bottomW + 0.15)
      slide.addShape('roundRect', {
        x, y: bottomY, w: bottomW, h: bottomH,
        fill: { color: c.bg.length === 8 ? c.bg.slice(0, 6) : c.bg, transparency: c.bg.length === 8 ? 70 : 0 },
        line: { color: c.border, width: 1 },
        rectRadius: 0.12,
      })
      slide.addText(c.label, {
        x: x + 0.2, y: bottomY + 0.15, w: bottomW - 0.4, h: 0.3,
        fontFace: BRAND_FONT, fontSize: 11, color: COLOR_TEXT_MUTED,
      })
      slide.addText(c.value, {
        x: x + 0.2, y: bottomY + 0.45, w: bottomW - 0.4, h: 0.65,
        fontFace: BRAND_FONT, fontSize: c.label === 'ROAS' ? 30 : 24,
        bold: true, color: c.fg,
      })
    })

    addFooter(slide, 3, totalPagesPlaceholder, periodLabel)
  }

  // ═════════ 슬라이드 4 — 채널별 성과 (대시보드 스타일: 도넛 + 퍼널 비교 테이블) ═════════
  {
    const slide = pptx.addSlide()
    addTitle(slide, '채널별 성과', `${data.byChannel.length}개 채널 · 리드 내림차순`)

    const channelRows = [...data.byChannel].sort((a, b) => b.leads - a.leads)
    const totalLeads = channelRows.reduce((s, c) => s + c.leads, 0)
    const maxSpend = Math.max(1, ...channelRows.map((c) => c.adSpend))
    const sumAdSpend = channelRows.reduce((s, c) => s + c.adSpend, 0)
    const sumRevenue = channelRows.reduce((s, c) => s + c.revenue, 0)
    const totalROAS = sumAdSpend > 0 ? sumRevenue / sumAdSpend : 0

    const is3550 = data.eventId === '3550'
    const reserveLabel = is3550 ? '예약' : '방문예약'
    const contractLabel = is3550 ? '계약' : '결제'

    const CHANNEL_COLORS: Record<string, string> = {
      meta: '1877F2',
      tiktok: '000000',
      google: '4285F4',
      naver: '03C75A',
      kakao: 'FEE500',
      karrot: 'FF7E1D',
    }

    // ───── 좌측 패널: 채널 비중 (도넛 + 광고비 바) ─────
    const leftX = 0.5
    const leftY = 1.7
    const leftW = 4.3
    const leftH = 5.1
    slide.addShape('roundRect', {
      x: leftX, y: leftY, w: leftW, h: leftH,
      fill: { color: 'FFFFFF' },
      line: { color: COLOR_BORDER, width: 1 },
      rectRadius: 0.1,
    })
    slide.addText('채널 비중', {
      x: leftX + 0.2, y: leftY + 0.15, w: leftW - 0.4, h: 0.3,
      fontFace: BRAND_FONT, fontSize: 14, bold: true, color: COLOR_TEXT_DARK,
    })
    slide.addText('리드 기준', {
      x: leftX + 0.2, y: leftY + 0.15, w: leftW - 0.4, h: 0.3,
      fontFace: BRAND_FONT, fontSize: 10, color: COLOR_TEXT_MUTED,
      align: 'right',
    })

    // 도넛 (pptxgenjs native doughnut chart)
    const donutData = [{
      name: '리드 비중',
      labels: channelRows.map((c) => CHANNEL_KO[c.channel] ?? c.channel),
      values: channelRows.map((c) => c.leads),
    }]
    slide.addChart(pptx.ChartType.doughnut, donutData, {
      x: leftX + 0.2, y: leftY + 0.55, w: 1.7, h: 1.7,
      chartColors: channelRows.map((c) => CHANNEL_COLORS[c.channel] ?? COLOR_BRAND),
      showLegend: false,
      showTitle: false,
      showValue: false,
      dataBorder: { pt: 1.5, color: 'FFFFFF' },
      holeSize: 55,
    })
    // 도넛 중앙 총 리드
    slide.addText('총 리드', {
      x: leftX + 0.2, y: leftY + 1.25, w: 1.7, h: 0.25,
      align: 'center', fontFace: BRAND_FONT, fontSize: 9, color: COLOR_TEXT_MUTED,
    })
    slide.addText(fmtNumber(totalLeads), {
      x: leftX + 0.2, y: leftY + 1.45, w: 1.7, h: 0.35,
      align: 'center', fontFace: BRAND_FONT, fontSize: 16, bold: true, color: COLOR_TEXT_DARK,
    })

    // 도넛 우측 범례 (컬러점 + 채널명 + %)
    const legendX = leftX + 2.05
    const legendTop = leftY + 0.55
    channelRows.forEach((c, i) => {
      const rowY = legendTop + i * 0.3
      const share = totalLeads > 0 ? (c.leads / totalLeads) * 100 : 0
      slide.addShape('ellipse', {
        x: legendX, y: rowY + 0.08, w: 0.12, h: 0.12,
        fill: { color: CHANNEL_COLORS[c.channel] ?? COLOR_BRAND },
        line: { color: CHANNEL_COLORS[c.channel] ?? COLOR_BRAND, width: 0 },
      })
      slide.addText(CHANNEL_KO[c.channel] ?? c.channel, {
        x: legendX + 0.2, y: rowY, w: 1.4, h: 0.28,
        fontFace: BRAND_FONT, fontSize: 10, bold: true, color: COLOR_TEXT_DARK,
      })
      slide.addText(`${share.toFixed(1)}%`, {
        x: legendX + 1.45, y: rowY, w: 0.6, h: 0.28,
        align: 'right',
        fontFace: BRAND_FONT, fontSize: 10, color: COLOR_TEXT_MUTED,
      })
    })

    // 구분선
    slide.addShape('line', {
      x: leftX + 0.2, y: leftY + 2.5, w: leftW - 0.4, h: 0,
      line: { color: COLOR_BORDER, width: 0.75 },
    })

    // 광고비 바 (채널별)
    slide.addText('광고비', {
      x: leftX + 0.2, y: leftY + 2.65, w: leftW - 0.4, h: 0.28,
      fontFace: BRAND_FONT, fontSize: 12, bold: true, color: COLOR_TEXT_DARK,
    })
    slide.addText('채널별 지출', {
      x: leftX + 0.2, y: leftY + 2.65, w: leftW - 0.4, h: 0.28,
      align: 'right',
      fontFace: BRAND_FONT, fontSize: 9, color: COLOR_TEXT_MUTED,
    })
    const barTop = leftY + 3.0
    const barSlotH = Math.min(0.28, (leftH - 3.15) / Math.max(1, channelRows.length))
    channelRows.forEach((c, i) => {
      const rowY = barTop + i * barSlotH
      const pct = Math.max(0.05, c.adSpend / maxSpend)
      // 채널 라벨
      slide.addText(CHANNEL_KO[c.channel] ?? c.channel, {
        x: leftX + 0.2, y: rowY + 0.02, w: 1.1, h: barSlotH - 0.05,
        fontFace: BRAND_FONT, fontSize: 9, bold: true, color: COLOR_TEXT_DARK,
      })
      // 바 배경
      const trackX = leftX + 1.35
      const trackW = 2.0
      const trackY = rowY + 0.07
      const trackH = 0.14
      slide.addShape('roundRect', {
        x: trackX, y: trackY, w: trackW, h: trackH,
        fill: { color: 'F1F5F9' },
        line: { color: 'F1F5F9', width: 0 },
        rectRadius: 0.04,
      })
      // 바 실선
      slide.addShape('roundRect', {
        x: trackX, y: trackY, w: trackW * pct, h: trackH,
        fill: { color: CHANNEL_COLORS[c.channel] ?? COLOR_BRAND },
        line: { color: CHANNEL_COLORS[c.channel] ?? COLOR_BRAND, width: 0 },
        rectRadius: 0.04,
      })
      // 금액
      slide.addText(fmtKRW(c.adSpend), {
        x: leftX + 3.4, y: rowY + 0.02, w: 0.85, h: barSlotH - 0.05,
        align: 'right',
        fontFace: BRAND_FONT, fontSize: 9, bold: true, color: COLOR_TEXT_DARK,
      })
    })

    // ───── 우측 패널: 채널 퍼널 비교 테이블 ─────
    const rightX = 5.0
    const rightY = 1.7
    const rightW = SLIDE_W - 5.5
    const rightH = 5.1
    slide.addShape('roundRect', {
      x: rightX, y: rightY, w: rightW, h: rightH,
      fill: { color: 'FFFFFF' },
      line: { color: COLOR_BORDER, width: 1 },
      rectRadius: 0.1,
    })
    slide.addText('채널별 퍼널', {
      x: rightX + 0.2, y: rightY + 0.15, w: rightW - 0.4, h: 0.3,
      fontFace: BRAND_FONT, fontSize: 14, bold: true, color: COLOR_TEXT_DARK,
    })

    // 테이블 구성 — 각 채널당 2컬럼(수·전환/단가) + 단계 컬럼 1개
    const stageDefs = [
      { label: '노출', getValue: (c: typeof channelRows[0]) => ({ v: c.impressions, cvr: null as number | null, cpa: null as number | null }) },
      { label: '클릭', getValue: (c: typeof channelRows[0]) => ({ v: c.clicks, cvr: c.impressions > 0 ? c.clicks / c.impressions : 0, cpa: c.clicks > 0 ? c.adSpend / c.clicks : 0 }) },
      { label: '리드', getValue: (c: typeof channelRows[0]) => ({ v: c.leads, cvr: c.clicks > 0 ? c.leads / c.clicks : 0, cpa: c.cpa_lead }) },
      { label: reserveLabel, getValue: (c: typeof channelRows[0]) => ({ v: c.reservations, cvr: c.leads > 0 ? c.reservations / c.leads : 0, cpa: c.cpa_reservation }) },
      { label: contractLabel, getValue: (c: typeof channelRows[0]) => ({ v: c.contracts, cvr: c.reservations > 0 ? c.contracts / c.reservations : 0, cpa: c.cpa_contract }) },
    ]

    // 헤더 1: 단계(2행 스팬) + 채널명(2컬럼 colspan)
    const headerRow1: PptxGenJS.TableRow = [
      { text: '단계', options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'left', rowspan: 2, valign: 'bottom' } },
      ...channelRows.map<PptxGenJS.TableCell>((c) => (
        { text: CHANNEL_KO[c.channel] ?? c.channel, options: { bold: true, fill: { color: COLOR_BG_LIGHT }, align: 'center', colspan: 2, color: CHANNEL_COLORS[c.channel] ?? COLOR_BRAND } }
      )),
    ]
    // 헤더 2: 수 / 전환·단가 (첫 컬럼은 rowspan 때문에 생략)
    const headerRow2: PptxGenJS.TableRow = [
      ...channelRows.flatMap<PptxGenJS.TableCell>(() => [
        { text: '수', options: { fill: { color: COLOR_BG_LIGHT }, fontSize: 9, align: 'right', color: COLOR_TEXT_MUTED } },
        { text: '전환 / 단가', options: { fill: { color: COLOR_BG_LIGHT }, fontSize: 9, align: 'right', color: COLOR_TEXT_MUTED } },
      ]),
    ]

    // 본문 행
    const bodyRows: PptxGenJS.TableRow[] = stageDefs.map((s) => {
      const row: PptxGenJS.TableRow = [
        { text: s.label, options: { bold: true, align: 'left' } },
      ]
      channelRows.forEach((c) => {
        const { v, cvr, cpa } = s.getValue(c)
        row.push({ text: fmtNumber(v), options: { align: 'right', bold: true } })
        if (cvr !== null) {
          const cpaText = cpa && cpa > 0 ? fmtKRW(cpa) : '—'
          row.push({
            text: [
              { text: fmtPct(cvr), options: { fontSize: 10, bold: true } },
              { text: `\n${cpaText}`, options: { fontSize: 8, color: COLOR_TEXT_MUTED } },
            ],
            options: { align: 'right' },
          })
        } else {
          row.push({ text: '—', options: { align: 'right', color: COLOR_TEXT_MUTED } })
        }
      })
      return row
    })

    // 합계 행 (광고비 / 매출 / ROAS) — 각 채널당 colspan:2
    const footerRows: PptxGenJS.TableRow[] = [
      [
        { text: '광고비', options: { bold: true, align: 'left', color: COLOR_TEXT_MUTED, fontSize: 10 } },
        ...channelRows.map<PptxGenJS.TableCell>((c) => (
          { text: fmtKRW(c.adSpend), options: { bold: true, align: 'right', colspan: 2 } }
        )),
      ],
      [
        { text: '매출', options: { bold: true, align: 'left', color: COLOR_TEXT_MUTED, fontSize: 10 } },
        ...channelRows.map<PptxGenJS.TableCell>((c) => (
          { text: fmtKRW(c.revenue), options: { bold: true, align: 'right', colspan: 2 } }
        )),
      ],
      [
        { text: 'ROAS', options: { bold: true, align: 'left', color: COLOR_TEXT_MUTED, fontSize: 10 } },
        ...channelRows.map<PptxGenJS.TableCell>((c) => (
          { text: fmtPct(c.roas), options: { bold: true, align: 'right', colspan: 2, color: c.roas >= 1 ? COLOR_SUCCESS : COLOR_WARN } }
        )),
      ],
    ]

    // 컬럼 폭 — 첫 컬럼 넓게 + 각 채널 2컬럼
    const stageColW = 0.9
    const valColW = (rightW - 0.4 - stageColW) / (channelRows.length * 2)
    const colW = [stageColW, ...channelRows.flatMap(() => [valColW, valColW])]

    slide.addTable([headerRow1, headerRow2, ...bodyRows, ...footerRows], {
      x: rightX + 0.2, y: rightY + 0.55, w: rightW - 0.4, colW,
      fontFace: BRAND_FONT, fontSize: 11,
      border: { type: 'solid', color: COLOR_BORDER, pt: 0.5 },
      rowH: 0.35,
    })

    // 합계 요약 (하단)
    const summaryY = rightY + rightH - 0.45
    slide.addShape('line', {
      x: rightX + 0.2, y: summaryY - 0.05, w: rightW - 0.4, h: 0,
      line: { color: COLOR_BORDER, width: 0.5 },
    })
    slide.addText(`합계 광고비 ${fmtKRW(sumAdSpend)}`, {
      x: rightX + 0.2, y: summaryY, w: (rightW - 0.4) / 3, h: 0.3,
      fontFace: BRAND_FONT, fontSize: 10, color: COLOR_TEXT_DARK,
    })
    slide.addText(`합계 매출 ${fmtKRW(sumRevenue)}`, {
      x: rightX + 0.2 + (rightW - 0.4) / 3, y: summaryY, w: (rightW - 0.4) / 3, h: 0.3,
      align: 'center',
      fontFace: BRAND_FONT, fontSize: 10, color: COLOR_TEXT_DARK,
    })
    slide.addText([
      { text: '전체 ROAS ', options: { color: COLOR_TEXT_DARK } },
      { text: fmtPct(totalROAS), options: { bold: true, color: totalROAS >= 1 ? COLOR_SUCCESS : COLOR_WARN } },
    ], {
      x: rightX + 0.2 + ((rightW - 0.4) * 2) / 3, y: summaryY, w: (rightW - 0.4) / 3, h: 0.3,
      align: 'right',
      fontFace: BRAND_FONT, fontSize: 10,
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

      // Combo: 리드·예약은 bar, 세션은 line
      const comboTypes: PptxGenJS.IChartMulti[] = [
        {
          type: pptx.ChartType.bar,
          data: [
            { name: '리드', labels, values: leadsVals },
            { name: '예약', labels, values: reservationsVals },
          ],
          options: {
            barDir: 'col',
            barGrouping: 'clustered',
            chartColors: [COLOR_WARN, COLOR_SUCCESS],
          },
        },
        {
          type: pptx.ChartType.line,
          data: [
            { name: '세션', labels, values: sessionsVals },
          ],
          options: {
            chartColors: [COLOR_BRAND],
            secondaryValAxis: true,
            secondaryCatAxis: true,
          },
        },
      ]
      // NOTE: pptxgenjs combo chart API — 2-arg form. 3-arg (with `[]` middle) causes plotArea.fill error.
      // TS declaration is 3-arg only → cast the slide to `any` just for this call.
      ;(slide as unknown as { addChart: (t: PptxGenJS.IChartMulti[], opts: PptxGenJS.IChartOpts) => void }).addChart(comboTypes, {
        x: 0.5, y: 1.8, w: SLIDE_W - 1, h: 5,
        showLegend: true,
        legendPos: 'b',
        catAxisLabelFontSize: 10,
        valAxisLabelFontSize: 10,
        dataLabelFontSize: 8,
        valAxes: [
          { showValAxisTitle: true, valAxisTitle: '리드·예약' },
          { showValAxisTitle: true, valAxisTitle: '세션', valGridLine: { style: 'none' } },
        ],
        catAxes: [
          { catAxisTitle: '' },
          { catAxisHidden: true },
        ],
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
