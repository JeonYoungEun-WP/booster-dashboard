/**
 * 이벤트 분석 데이터 → PDF (한글 지원, 이미지 기반)
 *
 * 전략: DOM 에 A4 가로 슬라이드를 임시 렌더 → html2canvas 로 캡처 → jsPDF 로 조립.
 * Pretendard 폰트는 사용자 브라우저에 설치된 것이 웹 페이지에서 사용되므로
 * 캡처된 PNG 안에 한글이 정확히 렌더됨.
 *
 * PPT(편집 가능)와 달리 PDF 는 이미지 페이지 — 편집은 불가하나 시각 충실도 높음.
 */

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { EventAnalyticsResponse } from './event-analytics-service'

const BRAND_NAME = 'boosterMAX'
const BRAND_FONT = 'Pretendard, system-ui, sans-serif'
const COLOR_BRAND = '#8B5CF6'
const COLOR_BRAND_DARK = '#6D28D9'
const COLOR_TEXT_DARK = '#171819'
const COLOR_TEXT_MUTED = '#868E96'
const COLOR_BORDER = '#E5E8EB'
const COLOR_BG_LIGHT = '#F5F6F8'
const COLOR_SUCCESS = '#10B981'
const COLOR_WARN = '#F59E0B'

function fmtKRW(n: number): string {
  return '₩' + Math.round(n).toLocaleString('ko-KR')
}
function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`
}

const CHANNEL_KO: Record<string, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  naver: 'Naver 검색광고',
  kakao: 'Kakao Moment',
  karrot: '당근 비즈',
}

/** A4 가로 크기 (mm) — jsPDF landscape */
const PAGE_W_MM = 297
const PAGE_H_MM = 210
/** 캡처 DOM 크기 (px) — 비율 PAGE_W_MM : PAGE_H_MM = 297 : 210 = 1.414:1 */
const SLIDE_W_PX = 1600
const SLIDE_H_PX = Math.round(1600 * 210 / 297)  // 1132

/** 공통 슬라이드 스타일 */
const baseSlideStyle: Partial<CSSStyleDeclaration> = {
  width: `${SLIDE_W_PX}px`,
  height: `${SLIDE_H_PX}px`,
  fontFamily: BRAND_FONT,
  color: COLOR_TEXT_DARK,
  backgroundColor: '#FFFFFF',
  boxSizing: 'border-box',
  position: 'relative',
  overflow: 'hidden',
}

function applyStyle(el: HTMLElement, style: Partial<CSSStyleDeclaration>) {
  for (const [key, value] of Object.entries(style)) {
    if (value !== undefined) (el.style as unknown as Record<string, string>)[key] = String(value)
  }
}

function createBaseSlide(): HTMLDivElement {
  const el = document.createElement('div')
  applyStyle(el, baseSlideStyle)
  return el
}

function renderCover(data: EventAnalyticsResponse, generatedAt: string): HTMLDivElement {
  const advertiser = data.realDataNote?.advertiser ?? `이벤트 ${data.eventId}`
  const periodLabel = `${data.period.startDate} ~ ${data.period.endDate}`

  const el = createBaseSlide()
  el.style.background = `linear-gradient(135deg, ${COLOR_BRAND} 0%, ${COLOR_BRAND_DARK} 100%)`
  el.style.color = '#FFFFFF'
  el.style.padding = '80px'
  el.innerHTML = `
    <div style="font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${BRAND_NAME}</div>
    <div style="position: absolute; left: 80px; top: 380px; right: 80px;">
      <div style="font-size: 72px; font-weight: 800; letter-spacing: -1px; line-height: 1.1;">${escapeHtml(advertiser)}</div>
      <div style="font-size: 36px; font-weight: 500; margin-top: 20px; opacity: 0.95;">랜딩페이지 성과 리포트</div>
    </div>
    <div style="position: absolute; left: 80px; top: 680px; right: 80px; display: flex; gap: 24px; align-items: center;">
      <div style="background: rgba(255,255,255,0.15); padding: 16px 28px; border-radius: 999px; font-size: 22px; font-weight: 600;">
        기간 · ${periodLabel}
      </div>
    </div>
    <div style="position: absolute; left: 80px; bottom: 60px; font-size: 18px; opacity: 0.7;">
      생성일: ${generatedAt.slice(0, 10)}
    </div>
    <div style="position: absolute; right: 80px; bottom: 60px; font-size: 18px; opacity: 0.7;">
      이벤트 ID: ${data.eventId}
    </div>
  `
  return el
}

function slideHeader(title: string, subtitle?: string): string {
  return `
    <div style="padding: 60px 80px 28px;">
      <div style="font-size: 44px; font-weight: 800; color: ${COLOR_TEXT_DARK}; letter-spacing: -0.5px;">${escapeHtml(title)}</div>
      ${subtitle ? `<div style="font-size: 20px; color: ${COLOR_TEXT_MUTED}; margin-top: 8px;">${escapeHtml(subtitle)}</div>` : ''}
      <div style="margin-top: 20px; height: 1px; background: ${COLOR_BORDER};"></div>
    </div>
  `
}

function slideFooter(pageNum: number, total: number, periodLabel: string): string {
  return `
    <div style="position: absolute; left: 80px; right: 80px; bottom: 40px; display: flex; justify-content: space-between; font-size: 14px; color: ${COLOR_TEXT_MUTED}; border-top: 1px solid ${COLOR_BORDER}; padding-top: 14px;">
      <div>${BRAND_NAME} · ${escapeHtml(periodLabel)}</div>
      <div>${pageNum} / ${total}</div>
    </div>
  `
}

function renderExecSummary(data: EventAnalyticsResponse, total: number, periodLabel: string): HTMLDivElement {
  const f = data.funnel
  const advertiser = data.realDataNote?.advertiser ?? `이벤트 ${data.eventId}`

  const kpis: Array<{ label: string; value: string; sub?: string; accent?: string }> = [
    { label: '광고비', value: fmtKRW(f.adSpend) },
    { label: '리드', value: fmtNumber(f.leads), sub: '폼 제출 완료' },
    { label: '예약', value: fmtNumber(f.visitReservations), sub: '상담 완료' },
    { label: '계약 (결제)', value: fmtNumber(f.reservations), sub: '매출 발생', accent: COLOR_SUCCESS },
    { label: '매출 (추정)', value: fmtKRW(f.reservationRevenue), sub: `객단가 ${fmtKRW(f.averageOrderValue)}` },
    { label: 'ROAS', value: `${(f.trueROAS_estimated * 100).toFixed(1)}%`, sub: '매출 ÷ 광고비',
      accent: f.trueROAS_estimated >= 1 ? COLOR_SUCCESS : COLOR_WARN },
  ]

  const roasPct = (f.trueROAS_estimated * 100).toFixed(1)

  const el = createBaseSlide()
  el.innerHTML = `
    ${slideHeader('한눈에 보는 성과', `${advertiser} · ${periodLabel}`)}
    <div style="padding: 20px 80px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;">
      ${kpis.map((k) => `
        <div style="border: 1px solid ${COLOR_BORDER}; border-radius: 16px; padding: 28px; background: #FFFFFF;">
          <div style="font-size: 18px; color: ${COLOR_TEXT_MUTED};">${escapeHtml(k.label)}</div>
          <div style="font-size: 48px; font-weight: 800; color: ${k.accent ?? COLOR_TEXT_DARK}; margin-top: 8px; letter-spacing: -0.5px;">${escapeHtml(k.value)}</div>
          ${k.sub ? `<div style="font-size: 15px; color: ${COLOR_TEXT_MUTED}; margin-top: 8px;">${escapeHtml(k.sub)}</div>` : ''}
        </div>
      `).join('')}
    </div>
    <div style="padding: 40px 80px 0; font-size: 22px; font-style: italic; color: ${COLOR_TEXT_DARK};">
      광고비 ${fmtKRW(f.adSpend)} 투입으로 리드 ${fmtNumber(f.leads)}건, 최종 계약 ${fmtNumber(f.reservations)}건 확보 · ROAS ${roasPct}%
    </div>
    ${slideFooter(2, total, periodLabel)}
  `
  return el
}

function renderFunnel(data: EventAnalyticsResponse, total: number, periodLabel: string): HTMLDivElement {
  const f = data.funnel
  const stages = [
    { label: '노출', value: f.impressions, cvr: null as number | null, cpa: null as number | null },
    { label: '클릭', value: f.clicks, cvr: f.ctr / 100, cpa: f.cpc },
    { label: '리드', value: f.leads, cvr: f.cvr_session_to_lead, cpa: f.cpa_lead },
    { label: '예약', value: f.visitReservations, cvr: f.cvr_lead_to_visitReservation, cpa: f.cpa_visitReservation },
    { label: '계약', value: f.reservations, cvr: f.cvr_visitReservation_to_payment, cpa: f.cpa_reservation },
  ]
  const topVal = stages[0].value || 1

  const el = createBaseSlide()
  el.innerHTML = `
    ${slideHeader('광고비 → 계약 퍼널', '단계별 수 · 전환율 · 획득당 비용')}
    <div style="padding: 20px 80px;">
      ${stages.map((s, i) => {
        const barW = Math.max(4, (s.value / topVal) * 100)
        const alpha = 1 - i * 0.15
        return `
          <div style="display: flex; align-items: center; gap: 20px; padding: 16px 0; border-bottom: 1px solid ${COLOR_BORDER};">
            <div style="flex: 0 0 110px; font-size: 24px; font-weight: 700;">${escapeHtml(s.label)}</div>
            <div style="flex: 0 0 140px; font-size: 28px; font-weight: 800; color: ${COLOR_BRAND};">${fmtNumber(s.value)}</div>
            <div style="flex: 1 1 auto; position: relative; height: 28px; background: ${COLOR_BG_LIGHT}; border-radius: 6px;">
              <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${barW}%; background: ${COLOR_BRAND}; opacity: ${alpha}; border-radius: 6px;"></div>
            </div>
            <div style="flex: 0 0 240px; font-size: 16px; color: ${COLOR_TEXT_MUTED}; text-align: right;">
              ${s.cvr !== null
                ? `전환율 ${fmtPct(s.cvr)} · CPA ${fmtKRW(s.cpa ?? 0)}`
                : '시작'}
            </div>
          </div>
        `
      }).join('')}
    </div>
    ${slideFooter(3, total, periodLabel)}
  `
  return el
}

function renderChannelTable(data: EventAnalyticsResponse, total: number, periodLabel: string): HTMLDivElement {
  const channels = [...data.byChannel].sort((a, b) => b.leads - a.leads)
  const el = createBaseSlide()
  el.innerHTML = `
    ${slideHeader('채널별 성과', `${channels.length}개 채널 · 리드 내림차순`)}
    <div style="padding: 20px 80px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 18px;">
        <thead>
          <tr style="background: ${COLOR_BG_LIGHT};">
            <th style="padding: 16px; text-align: left; border-bottom: 2px solid ${COLOR_BORDER};">채널</th>
            <th style="padding: 16px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">광고비</th>
            <th style="padding: 16px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">클릭</th>
            <th style="padding: 16px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">리드</th>
            <th style="padding: 16px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">예약</th>
            <th style="padding: 16px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">계약</th>
            <th style="padding: 16px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">CPA</th>
            <th style="padding: 16px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">ROAS</th>
          </tr>
        </thead>
        <tbody>
          ${channels.map((c) => `
            <tr>
              <td style="padding: 14px 16px; border-bottom: 1px solid ${COLOR_BORDER}; font-weight: 600;">${escapeHtml(CHANNEL_KO[c.channel] ?? c.channel)}</td>
              <td style="padding: 14px 16px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtKRW(c.adSpend)}</td>
              <td style="padding: 14px 16px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.clicks)}</td>
              <td style="padding: 14px 16px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.leads)}</td>
              <td style="padding: 14px 16px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.reservations)}</td>
              <td style="padding: 14px 16px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.contracts)}</td>
              <td style="padding: 14px 16px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${c.cpa_lead > 0 ? fmtKRW(c.cpa_lead) : '—'}</td>
              <td style="padding: 14px 16px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right; font-weight: 700; color: ${c.roas >= 1 ? COLOR_SUCCESS : COLOR_WARN};">${fmtPct(c.roas)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${slideFooter(4, total, periodLabel)}
  `
  return el
}

function renderTrackingCodeTable(data: EventAnalyticsResponse, total: number, periodLabel: string): HTMLDivElement {
  const codes = data.byTrackingCode.slice(0, 10)
  const el = createBaseSlide()
  el.innerHTML = `
    ${slideHeader('광고세트별 성과', `트래킹코드 상위 ${codes.length}개 · 광고비 내림차순`)}
    <div style="padding: 20px 80px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 16px;">
        <thead>
          <tr style="background: ${COLOR_BG_LIGHT};">
            <th style="padding: 14px; text-align: left; border-bottom: 2px solid ${COLOR_BORDER};">트래킹코드</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">광고비</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">노출</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">클릭</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">리드</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">예약</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">CPA</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">ROAS</th>
          </tr>
        </thead>
        <tbody>
          ${codes.map((c) => `
            <tr>
              <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; font-family: Consolas, monospace; font-size: 14px;">${escapeHtml(c.trackingCode)}</td>
              <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtKRW(c.adSpend)}</td>
              <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.impressions)}</td>
              <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.clicks)}</td>
              <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.leads)}</td>
              <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.reservations)}</td>
              <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${c.cpa_lead > 0 ? fmtKRW(c.cpa_lead) : '—'}</td>
              <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right; font-weight: 700; color: ${c.reservationROAS >= 1 ? COLOR_SUCCESS : COLOR_WARN};">${fmtPct(c.reservationROAS)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${slideFooter(5, total, periodLabel)}
  `
  return el
}

function renderDailyTrend(data: EventAnalyticsResponse, total: number, periodLabel: string): HTMLDivElement {
  const leadsSection = data.leads as { byDate?: Array<{ date: string; leads: number; reservations: number }> } | null
  const byDate = leadsSection?.byDate ?? []
  const maxLeads = Math.max(1, ...byDate.map((d) => d.leads))

  const el = createBaseSlide()
  el.innerHTML = `
    ${slideHeader('일자별 추이', '리드·예약 분포')}
    <div style="padding: 20px 80px;">
      ${byDate.length === 0 ? `
        <div style="text-align: center; padding: 80px 0; color: ${COLOR_TEXT_MUTED}; font-size: 20px;">
          일자별 데이터 없음
        </div>
      ` : `
        <div style="display: flex; align-items: flex-end; gap: 4px; height: 620px; padding: 40px 20px 60px; position: relative;">
          ${byDate.map((d) => {
            const leadBarH = (d.leads / maxLeads) * 500
            const resBarH = (d.reservations / maxLeads) * 500
            return `
              <div style="flex: 1 1 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 2px;">
                <div style="width: 100%; display: flex; align-items: flex-end; gap: 2px; height: 520px;">
                  <div style="flex: 1; height: ${leadBarH}px; background: ${COLOR_WARN}; border-radius: 3px 3px 0 0; opacity: 0.85;"></div>
                  <div style="flex: 1; height: ${resBarH}px; background: ${COLOR_SUCCESS}; border-radius: 3px 3px 0 0;"></div>
                </div>
                <div style="font-size: 10px; color: ${COLOR_TEXT_MUTED}; margin-top: 6px; transform: rotate(-45deg); transform-origin: center; white-space: nowrap;">${d.date.slice(5)}</div>
              </div>
            `
          }).join('')}
        </div>
        <div style="display: flex; gap: 24px; justify-content: center; margin-top: 20px; font-size: 16px;">
          <div><span style="display: inline-block; width: 14px; height: 14px; background: ${COLOR_WARN}; border-radius: 2px; margin-right: 6px;"></span>리드</div>
          <div><span style="display: inline-block; width: 14px; height: 14px; background: ${COLOR_SUCCESS}; border-radius: 2px; margin-right: 6px;"></span>예약</div>
        </div>
      `}
    </div>
    ${slideFooter(6, total, periodLabel)}
  `
  return el
}

function renderGa4Sources(data: EventAnalyticsResponse, total: number, periodLabel: string): HTMLDivElement {
  const ga4 = data.ga4 as {
    bySource?: Array<{ source: string; medium: string; campaign: string; sessions: number; conversions: number }>
    unavailable?: boolean
    error?: string
  } | null
  const sources = (ga4?.bySource ?? []).slice(0, 12)

  const el = createBaseSlide()
  if (sources.length === 0) {
    el.innerHTML = `
      ${slideHeader('GA4 유입 경로', '소스 · 매체 · 캠페인')}
      <div style="padding: 80px; text-align: center; color: ${COLOR_TEXT_MUTED}; font-size: 20px;">
        ${ga4?.unavailable ? 'GA4 미연결 — 자격증명 셋업 필요' :
          ga4?.error ? `GA4 에러: ${escapeHtml(ga4.error)}` :
          'GA4 소스 데이터 없음'}
      </div>
      ${slideFooter(7, total, periodLabel)}
    `
  } else {
    el.innerHTML = `
      ${slideHeader('GA4 유입 경로', `소스 · 매체 · 캠페인 상위 ${sources.length}`)}
      <div style="padding: 20px 80px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 16px;">
          <thead>
            <tr style="background: ${COLOR_BG_LIGHT};">
              <th style="padding: 14px; text-align: left; border-bottom: 2px solid ${COLOR_BORDER};">Source</th>
              <th style="padding: 14px; text-align: left; border-bottom: 2px solid ${COLOR_BORDER};">Medium</th>
              <th style="padding: 14px; text-align: left; border-bottom: 2px solid ${COLOR_BORDER};">Campaign</th>
              <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">Sessions</th>
              <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">Conversions</th>
            </tr>
          </thead>
          <tbody>
            ${sources.map((s) => `
              <tr>
                <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER};">${escapeHtml(s.source)}</td>
                <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; color: ${COLOR_TEXT_MUTED};">${escapeHtml(s.medium)}</td>
                <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; font-size: 13px; max-width: 520px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(s.campaign)}</td>
                <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(s.sessions)}</td>
                <td style="padding: 12px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(s.conversions)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${slideFooter(7, total, periodLabel)}
    `
  }
  return el
}

function renderActionItems(data: EventAnalyticsResponse, total: number, periodLabel: string): HTMLDivElement {
  const f = data.funnel
  const advertiser = data.realDataNote?.advertiser ?? `이벤트 ${data.eventId}`

  const channelRows = [...data.byChannel].sort((a, b) => b.roas - a.roas)
  const topChannel = channelRows[0]
  const topCode = data.byTrackingCode[0]

  const roasPct = (f.trueROAS_estimated * 100).toFixed(1)
  const roasJudge = f.trueROAS_estimated >= 1 ? '효율 확보 중' : '추가 최적화 필요'

  const bullets: string[] = [
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

  const el = createBaseSlide()
  el.innerHTML = `
    ${slideHeader('결론 & 액션 아이템', `${advertiser} 다음 단계 제안`)}
    <div style="padding: 30px 80px;">
      ${bullets.map((b) => `
        <div style="display: flex; gap: 16px; padding: 16px 0; font-size: 22px; line-height: 1.4;">
          <div style="flex: 0 0 20px; color: ${COLOR_BRAND}; font-weight: 800;">•</div>
          <div style="flex: 1;">${escapeHtml(b)}</div>
        </div>
      `).join('')}
    </div>
    <div style="position: absolute; left: 0; right: 0; bottom: 90px; text-align: center; font-size: 16px; color: ${COLOR_TEXT_MUTED};">
      ${BRAND_NAME} 성과 리포트
    </div>
    ${slideFooter(8, total, periodLabel)}
  `
  return el
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ───── 공개 빌더 ─────

export interface PdfBuildOptions {
  data: EventAnalyticsResponse
  generatedAt?: string
}

export async function buildReportPdf({ data, generatedAt = new Date().toISOString() }: PdfBuildOptions): Promise<Blob> {
  const total = 8
  const periodLabel = `${data.period.startDate} ~ ${data.period.endDate}`

  // 임시 컨테이너 — 화면 밖에 렌더 (offscreen)
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '0'
  container.style.zIndex = '-1'
  container.style.pointerEvents = 'none'
  document.body.appendChild(container)

  const slides: HTMLDivElement[] = [
    renderCover(data, generatedAt),
    renderExecSummary(data, total, periodLabel),
    renderFunnel(data, total, periodLabel),
    renderChannelTable(data, total, periodLabel),
    renderTrackingCodeTable(data, total, periodLabel),
    renderDailyTrend(data, total, periodLabel),
    renderGa4Sources(data, total, periodLabel),
    renderActionItems(data, total, periodLabel),
  ]

  for (const s of slides) container.appendChild(s)

  try {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    for (let i = 0; i < slides.length; i++) {
      const canvas = await html2canvas(slides[i], {
        width: SLIDE_W_PX,
        height: SLIDE_H_PX,
        scale: 1.5,
        backgroundColor: '#FFFFFF',
        useCORS: true,
        logging: false,
      })
      const img = canvas.toDataURL('image/png')
      if (i > 0) pdf.addPage('a4', 'landscape')
      pdf.addImage(img, 'PNG', 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, 'FAST')
    }

    const blob = pdf.output('blob')
    return blob
  } finally {
    container.remove()
  }
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
