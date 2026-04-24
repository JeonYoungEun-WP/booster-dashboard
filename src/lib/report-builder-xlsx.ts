/**
 * 이벤트 분석 데이터 → 디자인된 멀티시트 Excel (.xlsx) 생성
 *
 * boosterMAX 브랜드 테마 적용:
 *   - 헤더: 브랜드 그린 (#3ABA85) 배경 + 화이트 텍스트
 *   - 합계 행: 연한 그린 + 굵은 텍스트
 *   - Zebra striping: 짝수 행 연한 회색
 *   - 숫자 포맷: 통화(₩), 퍼센트(%), 천단위 구분
 *   - 모든 셀 테두리
 *   - 헤더 행 고정 (freeze pane)
 *   - 자동 필터
 *
 * 시트 구성:
 *   1. 요약       — KPI (이벤트 정보 + 퍼널 + 효율)
 *   2. 채널별     — Meta·TikTok 등 풀 퍼널
 *   3. 광고세트   — 트래킹코드 단위 상세
 *   4. 일자별     — 세션·리드·예약 일자 분포
 *   5. GA4 소스   — 소스/매체/캠페인
 *   6. 메타       — 이벤트 ID · 기간 · URL 후보
 */

import XLSX from 'xlsx-js-style'
import type { EventAnalyticsResponse } from './event-analytics-service'

// ───── 브랜드 팔레트 (design-guide) ─────
const COLOR_BRAND = '3ABA85'         // primary (헤더)
const COLOR_BRAND_LIGHT = 'E8F6EF'   // 연한 그린 (합계 배지)
const COLOR_BRAND_DARK = '2A9E6F'    // hover / 강조
const COLOR_HEADER_TEXT = 'FFFFFF'
const COLOR_ZEBRA = 'F8F9FC'         // 짝수 행 (아주 연한 회색)
const COLOR_BORDER = 'E1E4E9'
const COLOR_TEXT_DARK = '191A1F'
const COLOR_TEXT_MUTED = '6B7280'
const COLOR_SUCCESS = '22C55E'       // ROAS 1 이상
const COLOR_WARN = 'F59E0B'          // ROAS 1 미만
const COLOR_SECTION_BG = 'F3F4F6'    // 섹션 헤더 (요약 시트)

// ───── 숫자 포맷 상수 ─────
const FMT_CURRENCY = '₩#,##0'
const FMT_NUMBER = '#,##0'
const FMT_PERCENT = '0.00%'
const FMT_ROAS = '0.00%'
const FMT_DATE = 'yyyy-mm-dd'

// ───── 채널 한글 ─────
const CHANNEL_KO: Record<string, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  naver: 'Naver 검색광고',
  kakao: 'Kakao Moment',
  karrot: '당근 비즈',
}

// ───── 스타일 헬퍼 ─────
type Cell = XLSX.CellObject

function thinBorder() {
  const b = { style: 'thin' as const, color: { rgb: COLOR_BORDER } }
  return { top: b, bottom: b, left: b, right: b }
}

function baseFont(opts?: Partial<{ bold: boolean; color: string; size: number }>): XLSX.CellStyle['font'] {
  return {
    name: 'Pretendard',
    sz: opts?.size ?? 11,
    bold: opts?.bold ?? false,
    color: { rgb: opts?.color ?? COLOR_TEXT_DARK },
  }
}

function headerCell(text: string): Cell {
  return {
    t: 's',
    v: text,
    s: {
      font: baseFont({ bold: true, color: COLOR_HEADER_TEXT, size: 11 }),
      fill: { patternType: 'solid', fgColor: { rgb: COLOR_BRAND } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: thinBorder(),
    },
  }
}

function textCell(text: string, opts?: { bold?: boolean; align?: 'left' | 'right' | 'center'; color?: string; bg?: string }): Cell {
  return {
    t: 's',
    v: text,
    s: {
      font: baseFont({ bold: opts?.bold, color: opts?.color }),
      alignment: { horizontal: opts?.align ?? 'left', vertical: 'center' },
      fill: opts?.bg ? { patternType: 'solid', fgColor: { rgb: opts.bg } } : undefined,
      border: thinBorder(),
    },
  }
}

function numCell(
  value: number | string,
  format: string = FMT_NUMBER,
  opts?: { bold?: boolean; color?: string; bg?: string },
): Cell {
  const isDash = value === '—' || value === null || value === undefined
  return {
    t: isDash ? 's' : 'n',
    v: isDash ? '—' : Number(value),
    z: isDash ? undefined : format,
    s: {
      font: baseFont({ bold: opts?.bold, color: opts?.color ?? (isDash ? COLOR_TEXT_MUTED : COLOR_TEXT_DARK) }),
      alignment: { horizontal: 'right', vertical: 'center' },
      fill: opts?.bg ? { patternType: 'solid', fgColor: { rgb: opts.bg } } : undefined,
      border: thinBorder(),
    },
  }
}

function roasCell(ratio: number, opts?: { bold?: boolean; bg?: string }): Cell {
  // ratio 는 비율 (1.0103 = 101.03%) — Excel percent 포맷이 ×100 을 자동 적용하므로 그대로 ratio 저장
  const color = ratio >= 1 ? COLOR_SUCCESS : COLOR_WARN
  return {
    t: 'n',
    v: ratio,
    z: FMT_ROAS,
    s: {
      font: baseFont({ bold: opts?.bold ?? true, color }),
      alignment: { horizontal: 'right', vertical: 'center' },
      fill: opts?.bg ? { patternType: 'solid', fgColor: { rgb: opts.bg } } : undefined,
      border: thinBorder(),
    },
  }
}

function pctCell(ratio: number, opts?: { bold?: boolean; bg?: string }): Cell {
  // ratio 가 이미 % 값(0~100)인지 비율(0~1)인지 — 상황마다 다름. 여기선 caller 가 비율 전달하도록 통일.
  return {
    t: 'n',
    v: ratio,
    z: FMT_PERCENT,
    s: {
      font: baseFont({ bold: opts?.bold, color: COLOR_TEXT_DARK }),
      alignment: { horizontal: 'right', vertical: 'center' },
      fill: opts?.bg ? { patternType: 'solid', fgColor: { rgb: opts.bg } } : undefined,
      border: thinBorder(),
    },
  }
}

function currencyCell(v: number, opts?: { bold?: boolean; bg?: string }): Cell {
  return numCell(v, FMT_CURRENCY, opts)
}

function sectionBanner(text: string): Cell {
  return {
    t: 's',
    v: text,
    s: {
      font: baseFont({ bold: true, size: 12 }),
      fill: { patternType: 'solid', fgColor: { rgb: COLOR_SECTION_BG } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: thinBorder(),
    },
  }
}

/** AOA 를 스타일된 시트로 변환 — 각 cell 은 이미 Cell 객체. */
function aoaToStyledSheet(aoa: Cell[][], colWidths: number[]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const range = { s: { c: 0, r: 0 }, e: { c: (aoa[0]?.length ?? 1) - 1, r: aoa.length - 1 } }
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < aoa[r].length; c++) {
      const addr = XLSX.utils.encode_cell({ c, r })
      ws[addr] = aoa[r][c]
    }
  }
  ws['!ref'] = XLSX.utils.encode_range(range)
  ws['!cols'] = colWidths.map((w) => ({ wch: w }))
  // 헤더 행 높이
  ws['!rows'] = [{ hpt: 26 }]
  return ws
}

// ───── 본문 ─────

export interface XlsxBuildOptions {
  data: EventAnalyticsResponse
  generatedAt?: string
}

export function buildReportXlsx({ data, generatedAt = new Date().toISOString() }: XlsxBuildOptions): Blob {
  const wb = XLSX.utils.book_new()
  const f = data.funnel
  const advertiser = data.realDataNote?.advertiser ?? `이벤트 ${data.eventId}`
  const periodLabel = `${data.period.startDate} ~ ${data.period.endDate}`
  const is3550 = data.eventId === '3550'
  const reserveLabel = is3550 ? '예약' : '방문예약'
  const contractLabel = is3550 ? '계약' : '결제'

  // ══════════════════ Sheet 1: 요약 ══════════════════
  {
    const aoa: Cell[][] = [
      [headerCell('항목'), headerCell('값')],
      // 이벤트 정보
      [sectionBanner('📊 이벤트 정보'), sectionBanner('')],
      [textCell('이벤트 ID'), textCell(data.eventId, { align: 'right' })],
      [textCell('광고주'), textCell(advertiser, { align: 'right', bold: true })],
      [textCell('기간'), textCell(periodLabel, { align: 'right' })],
      [textCell('생성일'), textCell(generatedAt.slice(0, 10), { align: 'right' })],
      // 퍼널
      [sectionBanner('🔀 퍼널 수치'), sectionBanner('')],
      [textCell('노출'), numCell(f.impressions)],
      [textCell('클릭'), numCell(f.clicks)],
      [textCell('세션'), numCell(f.sessions)],
      [textCell('페이지뷰'), numCell(f.pageViews)],
      [textCell('리드'), numCell(f.leads, FMT_NUMBER, { bold: true })],
      [textCell(reserveLabel), numCell(f.visitReservations, FMT_NUMBER, { bold: true })],
      [textCell(contractLabel), numCell(f.reservations, FMT_NUMBER, { bold: true })],
      // 매출·ROAS
      [sectionBanner('💰 매출·ROAS'), sectionBanner('')],
      [textCell('광고비'), currencyCell(f.adSpend, { bold: true })],
      [textCell('객단가 (추정)'), currencyCell(f.averageOrderValue)],
      [textCell('매출 (추정)'), currencyCell(f.reservationRevenue, { bold: true })],
      [textCell('ROAS'), roasCell(f.trueROAS_estimated, { bold: true })],
      // 효율
      [sectionBanner('⚙️ 효율 지표'), sectionBanner('')],
      [textCell('CTR (클릭 ÷ 노출)'), pctCell(f.ctr / 100)],
      [textCell('CPC (광고비 ÷ 클릭)'), currencyCell(Math.round(f.cpc))],
      [textCell('CPA · 리드 획득당'), currencyCell(Math.round(f.cpa_lead))],
      [textCell(`${reserveLabel}당 단가`), currencyCell(Math.round(f.cpa_visitReservation))],
      [textCell(`${contractLabel}당 단가`), currencyCell(Math.round(f.cpa_reservation))],
      // 단계별 전환
      [sectionBanner('🎯 단계별 전환율'), sectionBanner('')],
      [textCell('클릭 → 리드'), pctCell(f.cvr_session_to_lead)],
      [textCell(`리드 → ${reserveLabel}`), pctCell(f.cvr_lead_to_visitReservation)],
      [textCell(`${reserveLabel} → ${contractLabel}`), pctCell(f.cvr_visitReservation_to_payment)],
    ]
    const ws = aoaToStyledSheet(aoa, [34, 20])
    // 헤더 행 고정
    ws['!freeze'] = { xSplit: 0, ySplit: 1 } as unknown as XLSX.WorkSheet['!freeze']
    // (xlsx-js-style 이 freeze 를 직접 지원하지 않아도 영향 없음 — 단순 속성)
    XLSX.utils.book_append_sheet(wb, ws, '요약')
  }

  // ══════════════════ Sheet 2: 채널별 ══════════════════
  {
    const channels = [...data.byChannel].sort((a, b) => b.leads - a.leads)
    const aoa: Cell[][] = [
      [
        headerCell('채널'),
        headerCell('광고비'),
        headerCell('노출'),
        headerCell('클릭'),
        headerCell('리드'),
        headerCell(reserveLabel),
        headerCell(contractLabel),
        headerCell('매출'),
        headerCell('CPA\n(리드)'),
        headerCell(`CPA\n(${reserveLabel})`),
        headerCell(`CPA\n(${contractLabel})`),
        headerCell('ROAS'),
      ],
    ]
    channels.forEach((c, i) => {
      const bg = i % 2 === 1 ? COLOR_ZEBRA : undefined
      aoa.push([
        textCell(CHANNEL_KO[c.channel] ?? c.channel, { bold: true, bg }),
        currencyCell(c.adSpend, { bg }),
        numCell(c.impressions, FMT_NUMBER, { bg }),
        numCell(c.clicks, FMT_NUMBER, { bg }),
        numCell(c.leads, FMT_NUMBER, { bold: true, bg }),
        numCell(c.reservations, FMT_NUMBER, { bg }),
        numCell(c.contracts, FMT_NUMBER, { bg }),
        currencyCell(c.revenue, { bg }),
        currencyCell(Math.round(c.cpa_lead), { bg }),
        c.cpa_reservation > 0 ? currencyCell(Math.round(c.cpa_reservation), { bg }) : numCell('—', FMT_NUMBER, { bg }),
        c.cpa_contract > 0 ? currencyCell(Math.round(c.cpa_contract), { bg }) : numCell('—', FMT_NUMBER, { bg }),
        roasCell(c.roas, { bg }),
      ])
    })
    // 합계
    const sum = channels.reduce((a, c) => ({
      adSpend: a.adSpend + c.adSpend, imp: a.imp + c.impressions, clk: a.clk + c.clicks,
      leads: a.leads + c.leads, rsv: a.rsv + c.reservations, ctr: a.ctr + c.contracts,
      rev: a.rev + c.revenue,
    }), { adSpend: 0, imp: 0, clk: 0, leads: 0, rsv: 0, ctr: 0, rev: 0 })
    const totalRoas = sum.adSpend > 0 ? sum.rev / sum.adSpend : 0
    const bg = COLOR_BRAND_LIGHT
    aoa.push([
      textCell('합계', { bold: true, bg }),
      currencyCell(sum.adSpend, { bold: true, bg }),
      numCell(sum.imp, FMT_NUMBER, { bold: true, bg }),
      numCell(sum.clk, FMT_NUMBER, { bold: true, bg }),
      numCell(sum.leads, FMT_NUMBER, { bold: true, bg }),
      numCell(sum.rsv, FMT_NUMBER, { bold: true, bg }),
      numCell(sum.ctr, FMT_NUMBER, { bold: true, bg }),
      currencyCell(sum.rev, { bold: true, bg }),
      sum.leads > 0 ? currencyCell(Math.round(sum.adSpend / sum.leads), { bold: true, bg }) : numCell('—', FMT_NUMBER, { bold: true, bg }),
      sum.rsv > 0 ? currencyCell(Math.round(sum.adSpend / sum.rsv), { bold: true, bg }) : numCell('—', FMT_NUMBER, { bold: true, bg }),
      sum.ctr > 0 ? currencyCell(Math.round(sum.adSpend / sum.ctr), { bold: true, bg }) : numCell('—', FMT_NUMBER, { bold: true, bg }),
      roasCell(totalRoas, { bold: true, bg }),
    ])

    const ws = aoaToStyledSheet(aoa, [18, 14, 12, 10, 9, 10, 9, 14, 12, 13, 13, 11])
    ws['!rows'] = [{ hpt: 32 }] // 2줄 헤더 높이
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 11, r: 0 } }) }
    XLSX.utils.book_append_sheet(wb, ws, '채널별')
  }

  // ══════════════════ Sheet 3: 광고세트 ══════════════════
  {
    const codes = data.byTrackingCode
    const aoa: Cell[][] = [
      [
        headerCell('트래킹코드'),
        headerCell('광고비'),
        headerCell('노출'),
        headerCell('클릭'),
        headerCell('리드'),
        headerCell(reserveLabel),
        headerCell('CPA\n(리드)'),
        headerCell(`${reserveLabel}당\n단가`),
        headerCell('ROAS'),
      ],
    ]
    codes.forEach((c, i) => {
      const bg = i % 2 === 1 ? COLOR_ZEBRA : undefined
      aoa.push([
        {
          t: 's',
          v: c.trackingCode,
          s: {
            font: { name: 'Consolas', sz: 11, color: { rgb: COLOR_TEXT_DARK } },
            alignment: { horizontal: 'left', vertical: 'center' },
            fill: bg ? { patternType: 'solid', fgColor: { rgb: bg } } : undefined,
            border: thinBorder(),
          },
        },
        currencyCell(c.adSpend, { bg }),
        numCell(c.impressions, FMT_NUMBER, { bg }),
        numCell(c.clicks, FMT_NUMBER, { bg }),
        numCell(c.leads, FMT_NUMBER, { bold: true, bg }),
        numCell(c.reservations, FMT_NUMBER, { bg }),
        c.cpa_lead > 0 ? currencyCell(Math.round(c.cpa_lead), { bg }) : numCell('—', FMT_NUMBER, { bg }),
        c.costPerReservation > 0 ? currencyCell(Math.round(c.costPerReservation), { bg }) : numCell('—', FMT_NUMBER, { bg }),
        roasCell(c.reservationROAS, { bg }),
      ])
    })
    // 합계
    const sum = codes.reduce((a, c) => ({
      adSpend: a.adSpend + c.adSpend, imp: a.imp + c.impressions, clk: a.clk + c.clicks,
      leads: a.leads + c.leads, rsv: a.rsv + c.reservations,
    }), { adSpend: 0, imp: 0, clk: 0, leads: 0, rsv: 0 })
    const totalRoasNum = codes.reduce((s, c) => s + c.reservationROAS * c.adSpend, 0)
    const totalRoas = sum.adSpend > 0 ? totalRoasNum / sum.adSpend : 0
    const bg = COLOR_BRAND_LIGHT
    aoa.push([
      textCell('합계', { bold: true, bg }),
      currencyCell(sum.adSpend, { bold: true, bg }),
      numCell(sum.imp, FMT_NUMBER, { bold: true, bg }),
      numCell(sum.clk, FMT_NUMBER, { bold: true, bg }),
      numCell(sum.leads, FMT_NUMBER, { bold: true, bg }),
      numCell(sum.rsv, FMT_NUMBER, { bold: true, bg }),
      sum.leads > 0 ? currencyCell(Math.round(sum.adSpend / sum.leads), { bold: true, bg }) : numCell('—', FMT_NUMBER, { bold: true, bg }),
      sum.rsv > 0 ? currencyCell(Math.round(sum.adSpend / sum.rsv), { bold: true, bg }) : numCell('—', FMT_NUMBER, { bold: true, bg }),
      roasCell(totalRoas, { bold: true, bg }),
    ])

    const ws = aoaToStyledSheet(aoa, [18, 14, 12, 10, 9, 10, 12, 14, 11])
    ws['!rows'] = [{ hpt: 32 }]
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 8, r: 0 } }) }
    XLSX.utils.book_append_sheet(wb, ws, '광고세트')
  }

  // ══════════════════ Sheet 4: 일자별 ══════════════════
  {
    const leadsSection = data.leads as { byDate?: Array<{ date: string; leads: number; reservations: number }> } | null
    const ga4Section = data.ga4 as { daily?: Array<{ date: string; sessions: number; activeUsers: number; conversions: number }> } | null

    const byDate = leadsSection?.byDate ?? []
    const ga4Daily = ga4Section?.daily ?? []
    const ga4Map = new Map(ga4Daily.map((d) => [d.date, d]))

    if (byDate.length > 0 || ga4Daily.length > 0) {
      const allDates = Array.from(new Set<string>([...byDate.map((d) => d.date), ...ga4Daily.map((d) => d.date)])).sort()
      const aoa: Cell[][] = [
        [
          headerCell('날짜'),
          headerCell('세션'),
          headerCell('활성 사용자'),
          headerCell('GA4 전환'),
          headerCell('리드'),
          headerCell(reserveLabel),
        ],
      ]
      allDates.forEach((date, i) => {
        const l = byDate.find((x) => x.date === date)
        const g = ga4Map.get(date)
        const bg = i % 2 === 1 ? COLOR_ZEBRA : undefined
        aoa.push([
          textCell(date, { align: 'center', bg }),
          numCell(g?.sessions ?? 0, FMT_NUMBER, { bg }),
          numCell(g?.activeUsers ?? 0, FMT_NUMBER, { bg }),
          numCell(g?.conversions ?? 0, FMT_NUMBER, { bg }),
          numCell(l?.leads ?? 0, FMT_NUMBER, { bold: true, bg }),
          numCell(l?.reservations ?? 0, FMT_NUMBER, { bg }),
        ])
      })
      // 합계
      const totalSessions = ga4Daily.reduce((s, d) => s + d.sessions, 0)
      const totalActive = ga4Daily.reduce((s, d) => s + d.activeUsers, 0)
      const totalConv = ga4Daily.reduce((s, d) => s + d.conversions, 0)
      const totalLeads = byDate.reduce((s, d) => s + d.leads, 0)
      const totalRsv = byDate.reduce((s, d) => s + d.reservations, 0)
      const bg = COLOR_BRAND_LIGHT
      aoa.push([
        textCell('합계', { bold: true, bg, align: 'center' }),
        numCell(totalSessions, FMT_NUMBER, { bold: true, bg }),
        numCell(totalActive, FMT_NUMBER, { bold: true, bg }),
        numCell(totalConv, FMT_NUMBER, { bold: true, bg }),
        numCell(totalLeads, FMT_NUMBER, { bold: true, bg }),
        numCell(totalRsv, FMT_NUMBER, { bold: true, bg }),
      ])
      const ws = aoaToStyledSheet(aoa, [14, 12, 14, 12, 10, 10])
      ws['!rows'] = [{ hpt: 26 }]
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 5, r: 0 } }) }
      XLSX.utils.book_append_sheet(wb, ws, '일자별')
    }
  }

  // ══════════════════ Sheet 5: GA4 소스 ══════════════════
  {
    const ga4Section = data.ga4 as {
      bySource?: Array<{ source: string; medium: string; campaign: string; sessions: number; conversions: number }>
    } | null
    const sources = ga4Section?.bySource ?? []
    if (sources.length > 0) {
      const aoa: Cell[][] = [
        [headerCell('Source'), headerCell('Medium'), headerCell('Campaign'), headerCell('Sessions'), headerCell('Conversions')],
      ]
      sources.forEach((s, i) => {
        const bg = i % 2 === 1 ? COLOR_ZEBRA : undefined
        aoa.push([
          textCell(s.source, { bold: true, bg }),
          textCell(s.medium, { bg, color: COLOR_TEXT_MUTED }),
          textCell(s.campaign, { bg }),
          numCell(s.sessions, FMT_NUMBER, { bold: true, bg }),
          numCell(s.conversions, FMT_NUMBER, { bg }),
        ])
      })
      // 합계
      const totalSessions = sources.reduce((s, r) => s + r.sessions, 0)
      const totalConv = sources.reduce((s, r) => s + r.conversions, 0)
      const bg = COLOR_BRAND_LIGHT
      aoa.push([
        textCell('합계', { bold: true, bg }),
        textCell('—', { bg, color: COLOR_TEXT_MUTED }),
        textCell(`소스 ${sources.length}개`, { bg, color: COLOR_TEXT_MUTED }),
        numCell(totalSessions, FMT_NUMBER, { bold: true, bg }),
        numCell(totalConv, FMT_NUMBER, { bold: true, bg }),
      ])
      const ws = aoaToStyledSheet(aoa, [20, 14, 48, 12, 14])
      ws['!rows'] = [{ hpt: 26 }]
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 4, r: 0 } }) }
      XLSX.utils.book_append_sheet(wb, ws, 'GA4 소스')
    }
  }

  // ══════════════════ Sheet 6: 메타 ══════════════════
  {
    const aoa: Cell[][] = [
      [headerCell('항목'), headerCell('값')],
      [textCell('이벤트 ID'), textCell(data.eventId, { align: 'right' })],
      [textCell('광고주'), textCell(advertiser, { align: 'right', bold: true })],
      [textCell('기간'), textCell(periodLabel, { align: 'right' })],
      [textCell('생성일'), textCell(generatedAt, { align: 'right' })],
      [sectionBanner('🔗 랜딩 URL 후보'), sectionBanner('')],
      ...data.landingPaths.map((p, i): Cell[] => [
        textCell(`URL ${i + 1}`),
        textCell(`heypick.co.kr${p}`, { align: 'right', color: COLOR_BRAND_DARK }),
      ]),
    ]
    const ws = aoaToStyledSheet(aoa, [22, 60])
    XLSX.utils.book_append_sheet(wb, ws, '메타')
  }

  // ───── 브라우저 Blob ─────
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
