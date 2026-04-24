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
// boosterMAX 디자인 시스템 (design-guide)
const COLOR_BRAND = '#3ABA85'           // primary (브랜드 그린)
const COLOR_BRAND_DARK = '#2A9E6F'      // primary hover
const COLOR_BRAND_SUB = '#65CC91'       // 그라디언트 시작 (밝은 그린)
const COLOR_BRAND_ACCENT = '#5FA8FA'    // 그라디언트 끝 (블루)
const COLOR_TEXT_DARK = '#191A1F'
const COLOR_TEXT_MUTED = '#6B7280'
const COLOR_BORDER = '#E1E4E9'
const COLOR_BG_LIGHT = '#F3F4F6'
const COLOR_SUCCESS = '#22C55E'
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
  // boosterMAX 브랜드 그라디언트 — 135deg 그린 → 블루 (design-guide)
  el.style.background = `linear-gradient(135deg, ${COLOR_BRAND_SUB} 0%, ${COLOR_BRAND_ACCENT} 100%)`
  el.style.color = '#FFFFFF'
  el.style.padding = '80px'
  el.style.overflow = 'hidden'
  el.innerHTML = `
    <!-- 우측 상단 장식 서클 (브랜드 악센트) -->
    <div style="position: absolute; top: -80px; right: -60px; width: 280px; height: 280px; border-radius: 50%; background: ${COLOR_BRAND_SUB}; opacity: 0.45;"></div>
    <div style="position: absolute; top: 40px; right: 140px; width: 120px; height: 120px; border-radius: 50%; background: ${COLOR_BRAND_ACCENT}; opacity: 0.55;"></div>
    <div style="position: absolute; top: 160px; right: 40px; width: 70px; height: 70px; border-radius: 50%; background: ${COLOR_BRAND_DARK}; opacity: 0.35;"></div>

    <div style="position: relative; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">${BRAND_NAME}</div>
    <div style="position: absolute; left: 80px; top: 380px; right: 80px;">
      <div style="font-size: 72px; font-weight: 800; letter-spacing: -1px; line-height: 1.1;">${escapeHtml(advertiser)}</div>
      <div style="font-size: 36px; font-weight: 500; margin-top: 20px; opacity: 0.95;">랜딩페이지 성과 리포트</div>
    </div>
    <div style="position: absolute; left: 80px; top: 680px; right: 80px; display: flex; gap: 24px; align-items: center;">
      <div style="background: rgba(255,255,255,0.22); padding: 16px 28px; border-radius: 999px; font-size: 22px; font-weight: 600; backdrop-filter: blur(4px);">
        기간 · ${periodLabel}
      </div>
    </div>
    <div style="position: absolute; left: 80px; bottom: 60px; font-size: 18px; opacity: 0.75;">
      생성일: ${generatedAt.slice(0, 10)}
    </div>
    <div style="position: absolute; right: 80px; bottom: 60px; font-size: 18px; opacity: 0.75;">
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
  const is3550 = data.eventId === '3550'
  const reserveLabel = is3550 ? '예약' : '방문예약'
  const contractLabel = is3550 ? '계약' : '결제'

  // 5단계 카드 (대시보드 FunnelFlow 와 동일 구조)
  const stages = [
    { label: '노출', value: f.impressions, prevLabel: null, cvr: null as number | null, cpu: null as number | null, cpuLabel: '' },
    { label: '클릭', value: f.clicks, prevLabel: '노출', cvr: f.ctr / 100, cpu: f.cpc, cpuLabel: 'CPC · 클릭당 광고비' },
    { label: '리드', value: f.leads, prevLabel: '클릭', cvr: f.leads / Math.max(1, f.clicks), cpu: f.cpa_lead, cpuLabel: 'CPA · 리드 획득당' },
    { label: reserveLabel, value: f.visitReservations, prevLabel: '리드', cvr: f.cvr_lead_to_visitReservation, cpu: f.cpa_visitReservation, cpuLabel: `${reserveLabel}당 단가` },
    { label: contractLabel, value: f.reservations, prevLabel: reserveLabel, cvr: f.cvr_visitReservation_to_payment, cpu: f.cpa_reservation, cpuLabel: `${contractLabel}당 단가` },
  ]

  const el = createBaseSlide()
  el.innerHTML = `
    ${slideHeader('풀퍼널 분석', '단계별 수 · 전환율 · 획득당 비용')}
    <div style="padding: 10px 60px;">
      <!-- 5 카드 -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px;">
        ${stages.map((s) => {
          const convGood = s.cvr !== null && s.cvr >= 0.5
          return `
            <div style="border: 2px solid ${COLOR_BORDER}; border-radius: 14px; padding: 22px 18px; background: #FFFFFF;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="font-size: 18px; color: ${COLOR_TEXT_MUTED};">${escapeHtml(s.label)}</div>
              </div>
              <div style="font-size: 52px; font-weight: 800; color: ${COLOR_TEXT_DARK}; margin-top: 10px; letter-spacing: -1px; line-height: 1;">${fmtNumber(s.value)}</div>
              ${s.cvr !== null
                ? `<div style="font-size: 15px; margin-top: 12px; color: ${convGood ? COLOR_SUCCESS : '#E11D48'};">
                    <span style="color: ${COLOR_TEXT_MUTED};">${escapeHtml(s.prevLabel ?? '')} →</span> ${fmtPct(s.cvr)}
                  </div>`
                : `<div style="font-size: 15px; margin-top: 12px; color: ${COLOR_TEXT_MUTED};">시작</div>`}
              ${s.cpu !== null && s.cpu > 0
                ? `<div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid ${COLOR_BORDER};">
                    <div style="font-size: 12px; color: ${COLOR_TEXT_MUTED};">${escapeHtml(s.cpuLabel)}</div>
                    <div style="font-size: 22px; font-weight: 700; margin-top: 3px;">${fmtKRW(s.cpu)}</div>
                  </div>`
                : ''}
            </div>
          `
        }).join('')}
      </div>

      <!-- 하단 요약 4카드 -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 28px; padding-top: 28px; border-top: 1px solid ${COLOR_BORDER};">
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 20px 22px;">
          <div style="font-size: 16px; color: ${COLOR_TEXT_MUTED};">광고비</div>
          <div style="font-size: 34px; font-weight: 800; color: ${COLOR_TEXT_DARK}; margin-top: 6px; letter-spacing: -0.5px;">${fmtKRW(f.adSpend)}</div>
        </div>
        <div style="background: rgba(16,185,129,0.05); border: 1px solid #BBF7D0; border-radius: 14px; padding: 20px 22px;">
          <div style="font-size: 16px; color: #047857;">객단가 (추정)</div>
          <div style="font-size: 34px; font-weight: 800; color: #047857; margin-top: 6px; letter-spacing: -0.5px;">${fmtKRW(f.averageOrderValue)}</div>
        </div>
        <div style="background: #ECFDF5; border: 1px solid #86EFAC; border-radius: 14px; padding: 20px 22px;">
          <div style="font-size: 16px; color: #047857;">매출 (추정)</div>
          <div style="font-size: 34px; font-weight: 800; color: #065F46; margin-top: 6px; letter-spacing: -0.5px;">${fmtKRW(f.reservationRevenue)}</div>
        </div>
        <div style="background: ${f.trueROAS_estimated >= 1 ? 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)' : 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)'}; border: 2px solid ${f.trueROAS_estimated >= 1 ? '#6EE7B7' : '#FDE68A'}; border-radius: 14px; padding: 20px 22px;">
          <div style="font-size: 16px; color: ${COLOR_TEXT_MUTED};">ROAS</div>
          <div style="font-size: 42px; font-weight: 800; color: ${f.trueROAS_estimated >= 1 ? '#047857' : '#B45309'}; margin-top: 6px; letter-spacing: -0.5px;">${(f.trueROAS_estimated * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>
    ${slideFooter(3, total, periodLabel)}
  `
  return el
}

/** 도넛 SVG — 채널별 리드 비중 */
function renderDonutSvg(
  rows: Array<{ channel: string; leads: number; color: string }>,
  size: number,
): string {
  const total = rows.reduce((s, r) => s + r.leads, 0)
  if (total === 0) return ''
  const cx = size / 2, cy = size / 2
  const rOuter = size / 2 - 4
  const rInner = size * 0.3
  let startAngle = -Math.PI / 2   // 12시 방향 시작
  const paths = rows.map((r) => {
    const sweep = (r.leads / total) * Math.PI * 2
    const endAngle = startAngle + sweep
    const x1 = cx + rOuter * Math.cos(startAngle)
    const y1 = cy + rOuter * Math.sin(startAngle)
    const x2 = cx + rOuter * Math.cos(endAngle)
    const y2 = cy + rOuter * Math.sin(endAngle)
    const x3 = cx + rInner * Math.cos(endAngle)
    const y3 = cy + rInner * Math.sin(endAngle)
    const x4 = cx + rInner * Math.cos(startAngle)
    const y4 = cy + rInner * Math.sin(startAngle)
    const largeArc = sweep > Math.PI ? 1 : 0
    const d = `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`
    startAngle = endAngle
    return `<path d="${d}" fill="${r.color}" stroke="#FFFFFF" stroke-width="2" />`
  }).join('')
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${paths}
      <text x="${cx}" y="${cy - 10}" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="12" fill="${COLOR_TEXT_MUTED}">총 리드</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="24" font-weight="800" fill="${COLOR_TEXT_DARK}">${fmtNumber(total)}</text>
    </svg>
  `
}

const CHANNEL_COLOR_HEX: Record<string, string> = {
  meta: '#1877F2',
  tiktok: '#000000',
  google: '#4285F4',
  naver: '#03C75A',
  kakao: '#FEE500',
  karrot: '#FF7E1D',
}

function renderChannelTable(data: EventAnalyticsResponse, total: number, periodLabel: string): HTMLDivElement {
  const channels = [...data.byChannel].sort((a, b) => b.leads - a.leads)
  const donutRows = channels.map((c) => ({
    channel: c.channel,
    leads: c.leads,
    color: CHANNEL_COLOR_HEX[c.channel] ?? COLOR_BRAND,
  }))
  const totalLeads = channels.reduce((s, c) => s + c.leads, 0)
  const maxSpend = Math.max(1, ...channels.map((c) => c.adSpend))

  const is3550 = data.eventId === '3550'
  const reserveLabel = is3550 ? '예약' : '방문예약'
  const contractLabel = is3550 ? '계약' : '결제'

  // 요약 합계
  const sumAdSpend = channels.reduce((s, c) => s + c.adSpend, 0)
  const sumRevenue = channels.reduce((s, c) => s + c.revenue, 0)
  const totalROAS = sumAdSpend > 0 ? sumRevenue / sumAdSpend : 0

  const el = createBaseSlide()
  el.innerHTML = `
    ${slideHeader('채널별 성과', `${channels.length}개 채널 · 리드 내림차순`)}
    <div style="padding: 10px 60px; display: grid; grid-template-columns: 380px 1fr; gap: 20px;">
      <!-- 좌측: 채널 비중 (도넛 + 광고비 바) -->
      <div style="border: 1px solid ${COLOR_BORDER}; border-radius: 14px; padding: 20px;">
        <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px;">
          <div style="font-size: 18px; font-weight: 700;">채널 비중</div>
          <div style="font-size: 13px; color: ${COLOR_TEXT_MUTED};">리드 기준</div>
        </div>
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="flex: 0 0 170px;">
            ${renderDonutSvg(donutRows, 170)}
          </div>
          <ul style="flex: 1; margin: 0; padding: 0; list-style: none;">
            ${donutRows.map((d) => {
              const share = totalLeads > 0 ? (d.leads / totalLeads) * 100 : 0
              return `
                <li style="display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 14px;">
                  <span style="width: 12px; height: 12px; border-radius: 50%; background: ${d.color}; display: inline-block;"></span>
                  <span style="font-weight: 600; flex: 1;">${escapeHtml(CHANNEL_KO[d.channel] ?? d.channel)}</span>
                  <span style="color: ${COLOR_TEXT_MUTED}; font-size: 12px;">${share.toFixed(1)}%</span>
                </li>
              `
            }).join('')}
          </ul>
        </div>
        <div style="border-top: 1px solid ${COLOR_BORDER}; margin-top: 16px; padding-top: 16px;">
          <div style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">광고비 <span style="color: ${COLOR_TEXT_MUTED}; font-weight: 400; font-size: 12px; float: right;">채널별 지출</span></div>
          ${channels.map((c, i) => {
            const pct = Math.max(2, (c.adSpend / maxSpend) * 100)
            return `
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="flex: 0 0 70px; font-size: 12px; font-weight: 600;">${escapeHtml(CHANNEL_KO[c.channel] ?? c.channel)}</span>
                <div style="flex: 1; height: 14px; background: #F1F5F9; border-radius: 4px; overflow: hidden;">
                  <div style="width: ${pct}%; height: 100%; background: ${donutRows[i].color}; border-radius: 4px;"></div>
                </div>
                <span style="flex: 0 0 auto; font-size: 12px; font-weight: 700;">${fmtKRW(c.adSpend)}</span>
              </div>
            `
          }).join('')}
        </div>
      </div>

      <!-- 우측: 채널별 퍼널 비교 테이블 (단계 컬럼 공유) -->
      <div style="border: 1px solid ${COLOR_BORDER}; border-radius: 14px; padding: 20px; overflow: hidden;">
        <div style="font-size: 18px; font-weight: 700; margin-bottom: 14px;">채널별 퍼널</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr>
              <th rowspan="2" style="padding: 6px 8px; text-align: left; color: ${COLOR_TEXT_MUTED}; border-bottom: 2px solid ${COLOR_BORDER}; vertical-align: bottom; width: 90px; font-size: 11px;">단계</th>
              ${channels.map((c) => `
                <th colspan="2" style="padding: 6px 8px; text-align: center; border-bottom: 1px solid ${COLOR_BORDER}; border-left: 1px solid ${COLOR_BORDER}; font-size: 13px; font-weight: 700;">
                  <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${CHANNEL_COLOR_HEX[c.channel] ?? COLOR_BRAND}; margin-right: 6px; vertical-align: middle;"></span>${escapeHtml(CHANNEL_KO[c.channel] ?? c.channel)}
                </th>
              `).join('')}
            </tr>
            <tr style="font-size: 10px; color: ${COLOR_TEXT_MUTED};">
              ${channels.map(() => `
                <th style="padding: 4px 6px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER}; border-left: 1px solid ${COLOR_BORDER};">수</th>
                <th style="padding: 4px 6px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER};">전환 / 단가</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${[
              { label: '노출', getValue: (c: typeof channels[0]) => ({ v: c.impressions, cvr: null, cpa: null }) },
              { label: '클릭', getValue: (c: typeof channels[0]) => ({ v: c.clicks, cvr: c.impressions > 0 ? c.clicks / c.impressions : 0, cpa: c.clicks > 0 ? c.adSpend / c.clicks : 0 }) },
              { label: '리드', getValue: (c: typeof channels[0]) => ({ v: c.leads, cvr: c.clicks > 0 ? c.leads / c.clicks : 0, cpa: c.cpa_lead }) },
              { label: reserveLabel, getValue: (c: typeof channels[0]) => ({ v: c.reservations, cvr: c.leads > 0 ? c.reservations / c.leads : 0, cpa: c.cpa_reservation }) },
              { label: contractLabel, getValue: (c: typeof channels[0]) => ({ v: c.contracts, cvr: c.reservations > 0 ? c.contracts / c.reservations : 0, cpa: c.cpa_contract }) },
            ].map((row) => `
              <tr>
                <td style="padding: 10px 8px; border-bottom: 1px solid ${COLOR_BORDER}; font-weight: 600;">${escapeHtml(row.label)}</td>
                ${channels.map((c) => {
                  const { v, cvr, cpa } = row.getValue(c)
                  return `
                    <td style="padding: 10px 6px; text-align: right; border-bottom: 1px solid ${COLOR_BORDER}; border-left: 1px solid ${COLOR_BORDER}; font-weight: 700; font-size: 14px;">${fmtNumber(v)}</td>
                    <td style="padding: 10px 6px; text-align: right; border-bottom: 1px solid ${COLOR_BORDER}; font-size: 11px;">
                      ${cvr !== null
                        ? `<div style="font-weight: 600;">${fmtPct(cvr)}</div><div style="color: ${COLOR_TEXT_MUTED}; font-size: 10px;">${cpa && cpa > 0 ? fmtKRW(cpa) : '—'}</div>`
                        : `<span style="color: ${COLOR_TEXT_MUTED};">—</span>`}
                    </td>
                  `
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
          <tfoot style="border-top: 2px solid ${COLOR_BORDER};">
            <tr>
              <td style="padding: 10px 8px; font-weight: 700; font-size: 13px; color: ${COLOR_TEXT_MUTED};">광고비</td>
              ${channels.map((c) => `<td colspan="2" style="padding: 10px 8px; text-align: right; border-left: 1px solid ${COLOR_BORDER}; font-weight: 700;">${fmtKRW(c.adSpend)}</td>`).join('')}
            </tr>
            <tr>
              <td style="padding: 10px 8px; font-weight: 700; font-size: 13px; color: ${COLOR_TEXT_MUTED};">매출</td>
              ${channels.map((c) => `<td colspan="2" style="padding: 10px 8px; text-align: right; border-left: 1px solid ${COLOR_BORDER}; font-weight: 700;">${fmtKRW(c.revenue)}</td>`).join('')}
            </tr>
            <tr>
              <td style="padding: 10px 8px; font-weight: 700; font-size: 13px; color: ${COLOR_TEXT_MUTED};">ROAS</td>
              ${channels.map((c) => `<td colspan="2" style="padding: 10px 8px; text-align: right; border-left: 1px solid ${COLOR_BORDER}; font-weight: 800; color: ${c.roas >= 1 ? COLOR_SUCCESS : COLOR_WARN};">${fmtPct(c.roas)}</td>`).join('')}
            </tr>
          </tfoot>
        </table>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid ${COLOR_BORDER}; display: flex; justify-content: space-between; font-size: 13px;">
          <div>합계 광고비 <strong>${fmtKRW(sumAdSpend)}</strong></div>
          <div>합계 매출 <strong>${fmtKRW(sumRevenue)}</strong></div>
          <div>전체 ROAS <strong style="color: ${totalROAS >= 1 ? COLOR_SUCCESS : COLOR_WARN};">${fmtPct(totalROAS)}</strong></div>
        </div>
      </div>
    </div>
    ${slideFooter(4, total, periodLabel)}
  `
  return el
}

function renderTrackingCodeTable(data: EventAnalyticsResponse, total: number, periodLabel: string): HTMLDivElement {
  const codes = data.byTrackingCode.slice(0, 10)

  // 합계 행 (전체 byTrackingCode 기준, 상위 10 이상도 포함해서 대시보드와 동일)
  const allCodes = data.byTrackingCode
  const sumAdSpend = allCodes.reduce((s, c) => s + c.adSpend, 0)
  const sumImpressions = allCodes.reduce((s, c) => s + c.impressions, 0)
  const sumClicks = allCodes.reduce((s, c) => s + c.clicks, 0)
  const sumLeads = allCodes.reduce((s, c) => s + c.leads, 0)
  const sumReservations = allCodes.reduce((s, c) => s + c.reservations, 0)
  const totalCpaLead = sumLeads > 0 ? sumAdSpend / sumLeads : 0
  const totalRoasNum = allCodes.reduce((s, c) => s + c.reservationROAS * c.adSpend, 0)
  const totalROAS = sumAdSpend > 0 ? totalRoasNum / sumAdSpend : 0

  const el = createBaseSlide()
  el.innerHTML = `
    ${slideHeader('광고세트별 성과', `트래킹코드 상위 ${codes.length}개 · 합계 기준 전체 ${allCodes.length}개 · 광고비 내림차순`)}
    <div style="padding: 20px 60px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
        <thead>
          <tr style="background: ${COLOR_BG_LIGHT};">
            <th style="padding: 14px; text-align: left; border-bottom: 2px solid ${COLOR_BORDER}; font-size: 13px; color: ${COLOR_TEXT_MUTED};">트래킹코드</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER}; font-size: 13px; color: ${COLOR_TEXT_MUTED};">광고비</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER}; font-size: 13px; color: ${COLOR_TEXT_MUTED};">노출</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER}; font-size: 13px; color: ${COLOR_TEXT_MUTED};">클릭</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER}; font-size: 13px; color: ${COLOR_TEXT_MUTED};">리드</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER}; font-size: 13px; color: ${COLOR_TEXT_MUTED};">예약</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER}; font-size: 13px; color: ${COLOR_TEXT_MUTED};">CPA</th>
            <th style="padding: 14px; text-align: right; border-bottom: 2px solid ${COLOR_BORDER}; font-size: 13px; color: ${COLOR_TEXT_MUTED};">ROAS</th>
          </tr>
        </thead>
        <tbody>
          <!-- 합계 행 (상단 강조) -->
          <tr style="background: ${COLOR_BG_LIGHT}; font-weight: 700;">
            <td style="padding: 12px 14px; border-bottom: 2px solid ${COLOR_BORDER};">합계</td>
            <td style="padding: 12px 14px; border-bottom: 2px solid ${COLOR_BORDER}; text-align: right;">${fmtKRW(sumAdSpend)}</td>
            <td style="padding: 12px 14px; border-bottom: 2px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(sumImpressions)}</td>
            <td style="padding: 12px 14px; border-bottom: 2px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(sumClicks)}</td>
            <td style="padding: 12px 14px; border-bottom: 2px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(sumLeads)}</td>
            <td style="padding: 12px 14px; border-bottom: 2px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(sumReservations)}</td>
            <td style="padding: 12px 14px; border-bottom: 2px solid ${COLOR_BORDER}; text-align: right;">${totalCpaLead > 0 ? fmtKRW(totalCpaLead) : '—'}</td>
            <td style="padding: 12px 14px; border-bottom: 2px solid ${COLOR_BORDER}; text-align: right; color: ${totalROAS >= 1 ? COLOR_SUCCESS : COLOR_WARN};">${fmtPct(totalROAS)}</td>
          </tr>
          ${codes.map((c) => `
            <tr>
              <td style="padding: 11px 14px; border-bottom: 1px solid ${COLOR_BORDER}; font-family: Consolas, monospace; font-size: 13px;">${escapeHtml(c.trackingCode)}</td>
              <td style="padding: 11px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtKRW(c.adSpend)}</td>
              <td style="padding: 11px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.impressions)}</td>
              <td style="padding: 11px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.clicks)}</td>
              <td style="padding: 11px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.leads)}</td>
              <td style="padding: 11px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${fmtNumber(c.reservations)}</td>
              <td style="padding: 11px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right;">${c.cpa_lead > 0 ? fmtKRW(c.cpa_lead) : '—'}</td>
              <td style="padding: 11px 14px; border-bottom: 1px solid ${COLOR_BORDER}; text-align: right; font-weight: 700; color: ${c.reservationROAS >= 1 ? COLOR_SUCCESS : COLOR_WARN};">${fmtPct(c.reservationROAS)}</td>
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
  const ga4Section = data.ga4 as { daily?: Array<{ date: string; sessions: number }> } | null

  const byDate = leadsSection?.byDate ?? []
  const ga4Daily = ga4Section?.daily ?? []
  const ga4Map = new Map(ga4Daily.map((d) => [d.date, d.sessions]))

  // 날짜 기준으로 정렬·정합 — leads·reservations 있으면 그 날짜를 기준, 없으면 ga4 날짜
  const allDates = (byDate.length > 0 ? byDate.map((d) => d.date) : ga4Daily.map((d) => d.date))
  const rows = allDates.map((date) => {
    const ld = byDate.find((x) => x.date === date)
    return {
      date,
      leads: ld?.leads ?? 0,
      reservations: ld?.reservations ?? 0,
      sessions: ga4Map.get(date) ?? 0,
    }
  })

  const maxSession = Math.max(1, ...rows.map((r) => r.sessions))
  const maxBar = Math.max(1, ...rows.map((r) => Math.max(r.leads, r.reservations)))

  // SVG 캔버스 (PDF 용 슬라이드 비율 1600x1132 기준 차트 영역 조정)
  const svgW = 1440
  const svgH = 620
  const padL = 70
  const padR = 70
  const padT = 40
  const padB = 70
  const cw = svgW - padL - padR
  const ch = svgH - padT - padB

  const n = rows.length
  const colW = n > 0 ? cw / n : 0
  const barW = Math.max(3, colW * 0.32)
  const gap = 2

  // 세션 라인 좌표 (좌축 maxSession 기준)
  const linePoints = rows.map((r, i) => {
    const x = padL + colW * (i + 0.5)
    const y = padT + ch - (r.sessions / maxSession) * ch
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  // 가이드라인 (좌 Y축 — 세션 기준, 5분할)
  const sessionGrid = [0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
    const y = padT + ch - ratio * ch
    const label = Math.round(maxSession * ratio).toLocaleString('ko-KR')
    return { y, label }
  })

  // 우 Y축 — 리드·예약 기준
  const barGrid = [0, 0.5, 1.0].map((ratio) => {
    const y = padT + ch - ratio * ch
    const label = Math.round(maxBar * ratio).toLocaleString('ko-KR')
    return { y, label }
  })

  const COLOR_SESSION = '#3983E2'           // 브랜드 딥 블루 (세션 라인)
  const COLOR_LEAD = '#65CC91'              // 브랜드 라이트 그린 (리드 막대)
  const COLOR_RESERVATION = '#2A9E6F'       // 브랜드 다크 그린 (예약 막대)

  const el = createBaseSlide()
  if (rows.length === 0) {
    el.innerHTML = `
      ${slideHeader('일자별 추이', '세션·리드·예약 일별 분포')}
      <div style="padding: 80px; text-align: center; color: ${COLOR_TEXT_MUTED}; font-size: 20px;">
        일자별 데이터 없음
      </div>
      ${slideFooter(6, total, periodLabel)}
    `
    return el
  }

  el.innerHTML = `
    ${slideHeader('일자별 추이', '세션(선) · 리드·예약(막대)')}
    <div style="padding: 10px 80px;">
      <svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="display: block;">
        <!-- 가이드라인 (세션 기준 grid) -->
        ${sessionGrid.map((g) => `
          <line x1="${padL}" y1="${g.y}" x2="${padL + cw}" y2="${g.y}" stroke="#EEF0F3" stroke-width="1" />
          <text x="${padL - 10}" y="${g.y + 4}" font-family="Pretendard, sans-serif" font-size="12" fill="${COLOR_TEXT_MUTED}" text-anchor="end">${g.label}</text>
        `).join('')}

        <!-- 우축 레이블 (리드·예약) -->
        ${barGrid.map((g) => `
          <text x="${padL + cw + 10}" y="${g.y + 4}" font-family="Pretendard, sans-serif" font-size="12" fill="${COLOR_TEXT_MUTED}" text-anchor="start">${g.label}</text>
        `).join('')}

        <!-- 축 라벨 -->
        <text x="${padL - 40}" y="${padT - 12}" font-family="Pretendard, sans-serif" font-size="13" font-weight="600" fill="${COLOR_SESSION}" text-anchor="start">세션</text>
        <text x="${padL + cw + 40}" y="${padT - 12}" font-family="Pretendard, sans-serif" font-size="13" font-weight="600" fill="${COLOR_LEAD}" text-anchor="end">리드·예약</text>

        <!-- 막대 (리드 + 예약, 우축 기준) -->
        ${rows.map((r, i) => {
          const cx = padL + colW * (i + 0.5)
          const leadH = (r.leads / maxBar) * ch
          const resH = (r.reservations / maxBar) * ch
          const leadX = cx - barW - gap / 2
          const resX = cx + gap / 2
          const leadY = padT + ch - leadH
          const resY = padT + ch - resH
          return `
            ${r.leads > 0 ? `<rect x="${leadX.toFixed(1)}" y="${leadY.toFixed(1)}" width="${barW.toFixed(1)}" height="${leadH.toFixed(1)}" fill="${COLOR_LEAD}" fill-opacity="0.78" rx="2" ry="2" />` : ''}
            ${r.reservations > 0 ? `<rect x="${resX.toFixed(1)}" y="${resY.toFixed(1)}" width="${barW.toFixed(1)}" height="${resH.toFixed(1)}" fill="${COLOR_RESERVATION}" fill-opacity="0.9" rx="2" ry="2" />` : ''}
          `
        }).join('')}

        <!-- 세션 선 (좌축) -->
        <polyline points="${linePoints}" fill="none" stroke="${COLOR_SESSION}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        ${rows.map((r, i) => {
          const x = padL + colW * (i + 0.5)
          const y = padT + ch - (r.sessions / maxSession) * ch
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${COLOR_SESSION}" />`
        }).join('')}

        <!-- X 축 날짜 (45도 회전) -->
        ${rows.map((r, i) => {
          const x = padL + colW * (i + 0.5)
          const y = padT + ch + 14
          const label = r.date.slice(5)
          return `<text x="${x.toFixed(1)}" y="${y}" font-family="Pretendard, sans-serif" font-size="11" fill="${COLOR_TEXT_MUTED}" text-anchor="end" transform="rotate(-45 ${x.toFixed(1)} ${y})">${label}</text>`
        }).join('')}

        <!-- X 축 선 -->
        <line x1="${padL}" y1="${padT + ch}" x2="${padL + cw}" y2="${padT + ch}" stroke="${COLOR_BORDER}" stroke-width="1" />
      </svg>

      <!-- 범례 -->
      <div style="display: flex; gap: 28px; justify-content: center; margin-top: 18px; font-size: 16px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 22px; height: 2.5px; background: ${COLOR_SESSION};"></span>
          <span style="font-weight: 600;">세션</span>
          <span style="color: ${COLOR_TEXT_MUTED}; font-size: 14px;">(좌축)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 14px; height: 14px; background: ${COLOR_LEAD}; border-radius: 2px; opacity: 0.78;"></span>
          <span style="font-weight: 600;">리드</span>
          <span style="color: ${COLOR_TEXT_MUTED}; font-size: 14px;">(우축)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 14px; height: 14px; background: ${COLOR_RESERVATION}; border-radius: 2px;"></span>
          <span style="font-weight: 600;">예약</span>
          <span style="color: ${COLOR_TEXT_MUTED}; font-size: 14px;">(우축)</span>
        </div>
      </div>
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
