'use client'

import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'
import { CHANNEL_LABEL, type AdChannel } from '@/src/lib/ad-data'

interface ChannelRow {
  channel: AdChannel
  adSpend: number
  leads: number
  reservations: number
  contracts?: number
  revenue: number
  cpa_lead: number
  cpa_reservation: number
  roas: number
}

interface TrackingCodeRow {
  trackingCode: string
  adSpend: number
  leads: number
  reservations: number
  reservationROAS: number
}

interface Funnel {
  adSpend: number
  leads: number
  visitReservations: number
  reservations: number
  cpa_lead: number
  cpa_visitReservation: number
  reservationRevenue: number
  trueROAS_estimated: number
}

interface Props {
  eventId: string
  advertiser: string
  period: { startDate: string; endDate: string }
  funnel: Funnel
  byChannel: ChannelRow[]
  byTrackingCode: TrackingCodeRow[]
}

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}
function fmtKRW(n: number): string {
  return Math.round(n).toLocaleString('ko-KR') + '원'
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

/**
 * 규칙 기반 5줄 AI 진단 생성.
 * - 핵심 성과 / 채널 효율 / Best 광고세트 / Worst 광고세트 / 개선 제안(액션 아이템)
 */
function buildDiagnosisBullets({
  funnel,
  byChannel,
  byTrackingCode,
}: Pick<Props, 'funnel' | 'byChannel' | 'byTrackingCode'>): string[] {
  const bullets: string[] = []

  // 1) 핵심 성과
  const core =
    `핵심 성과: 총 광고비 ${fmtKRW(funnel.adSpend)}, ${fmtNumber(funnel.leads)}건 전환(리드수) (CPA ${fmtKRW(funnel.cpa_lead)}), ` +
    `${fmtNumber(funnel.visitReservations)}건 방문예약 (CPA ${fmtKRW(funnel.cpa_visitReservation)}). ` +
    `총 매출 ${fmtKRW(funnel.reservationRevenue)}으로 ROAS ${(funnel.trueROAS_estimated * 100).toFixed(2)}%를 기록했습니다.`
  bullets.push(core)

  // 2) 채널 효율 — ROAS 비교
  const channelsSorted = [...byChannel].sort((a, b) => b.roas - a.roas)
  if (channelsSorted.length >= 2) {
    const [best, second] = channelsSorted
    const bestName = CHANNEL_LABEL[best.channel] ?? best.channel
    const secondName = CHANNEL_LABEL[second.channel] ?? second.channel
    const compareText =
      `채널 효율: ${bestName}이 ROAS ${fmtPct(best.roas)}로 ${secondName}(ROAS ${fmtPct(second.roas)})보다 ` +
      (best.roas > second.roas * 1.3 ? '월등히 높은' : '더 높은') +
      ` 효율을 보였습니다. ` +
      `리드 CPA (${bestName} ${fmtKRW(best.cpa_lead)} vs ${secondName} ${fmtKRW(second.cpa_lead)}) 및 ` +
      `방문예약 CPA (${bestName} ${fmtKRW(best.cpa_reservation)} vs ${secondName} ${fmtKRW(second.cpa_reservation)}) ` +
      (best.cpa_lead < second.cpa_lead && best.cpa_reservation < second.cpa_reservation
        ? `모두 ${bestName}이 우수합니다.`
        : `일부 항목에서 ${bestName}이 우위에 있습니다.`)
    bullets.push(compareText)
  } else if (channelsSorted.length === 1) {
    const only = channelsSorted[0]
    bullets.push(`채널 효율: ${CHANNEL_LABEL[only.channel] ?? only.channel} 단독 운영 — ROAS ${fmtPct(only.roas)}, 리드 CPA ${fmtKRW(only.cpa_lead)}.`)
  } else {
    bullets.push('채널 효율: 채널별 비교 데이터 없음.')
  }

  // 3) Best 광고세트 — ROAS 기준 (최소 리드 1건 이상)
  const validCodes = byTrackingCode.filter((c) => c.leads > 0)
  const bestCode = validCodes.sort((a, b) => b.reservationROAS - a.reservationROAS)[0]
  if (bestCode) {
    bullets.push(
      `Best 광고세트: '${bestCode.trackingCode}'가 ${fmtKRW(bestCode.adSpend)} 광고비로 리드 ${fmtNumber(bestCode.leads)}건, 예약 ${fmtNumber(bestCode.reservations)}건 달성 (ROAS ${fmtPct(bestCode.reservationROAS)}).`,
    )
  } else {
    bullets.push('Best 광고세트: 유효 리드 발생 광고세트 없음.')
  }

  // 4) Worst 광고세트 — 광고비는 썼는데 리드 0 (또는 전환 0)
  const worstCodes = byTrackingCode
    .filter((c) => c.adSpend > 0 && c.leads === 0)
    .sort((a, b) => b.adSpend - a.adSpend)
    .slice(0, 3)
  if (worstCodes.length > 0) {
    const codeNames = worstCodes.map((c) => `'${c.trackingCode}'`).join(', ')
    const spends = worstCodes.map((c) => fmtKRW(c.adSpend)).join(', ')
    bullets.push(
      `Worst 광고세트: ${codeNames}는 각각 ${spends} 지출에도 불구하고 리드/예약 전환이 0건으로 비효율적입니다.`,
    )
  } else {
    // 다음 Fallback — 리드는 있지만 ROAS 0
    const lowRoas = byTrackingCode
      .filter((c) => c.adSpend > 0 && c.reservationROAS < 0.3)
      .sort((a, b) => a.reservationROAS - b.reservationROAS)
      .slice(0, 3)
    if (lowRoas.length > 0) {
      const codeNames = lowRoas.map((c) => `'${c.trackingCode}'`).join(', ')
      bullets.push(
        `Worst 광고세트: ${codeNames}의 ROAS 가 30% 미만으로 개선 여지가 큽니다.`,
      )
    } else {
      bullets.push('Worst 광고세트: 눈에 띄는 비효율 광고세트 없음.')
    }
  }

  // 5) 개선 제안 (필수 액션 아이템)
  let suggestion = '개선 제안: '
  if (channelsSorted.length >= 2) {
    const [best, second] = channelsSorted
    const bestName = CHANNEL_LABEL[best.channel] ?? best.channel
    if (best.roas > second.roas * 1.3) {
      suggestion += `${bestName} 채널로 예산을 재분배하고, `
    } else {
      suggestion += `${bestName} 채널에 예산을 집중하고, `
    }
  }
  if (worstCodes.length > 0) {
    suggestion += `성과 없는 '${worstCodes[0].trackingCode}' 등 비효율적인 광고세트는 즉시 중단 및 재검토가 필요합니다.`
  } else {
    suggestion += '저 ROAS 광고세트의 크리에이티브·타겟팅 재점검이 필요합니다.'
  }
  bullets.push(suggestion)

  return bullets
}

export function AiDiagnosisCard({ eventId, advertiser, period, funnel, byChannel, byTrackingCode }: Props) {
  const bullets = buildDiagnosisBullets({ funnel, byChannel, byTrackingCode })
  const intro = `${advertiser} (이벤트 ID: ${eventId}, ${period.startDate} ~ ${period.endDate}) 성과 진단입니다.`

  return (
    <section className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500 text-white flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-base font-bold text-violet-900">AI 진단</h2>
            <p className="text-xs text-violet-600/80">광고 성과 자동 분석 리포트</p>
          </div>
        </div>
        <Link
          href="/ai"
          className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:text-violet-900 hover:underline whitespace-nowrap"
          title="AI 광고성과 분석 메뉴로 이동"
        >
          AI 진단으로 이동하기 <ArrowRight size={14} />
        </Link>
      </div>

      <p className="text-sm text-violet-900/90 mb-3">{intro}</p>

      <ul className="space-y-2.5">
        {bullets.map((text, i) => {
          // 접두사 (콜론 앞부분) 강조
          const colonIdx = text.indexOf(':')
          const prefix = colonIdx > -1 ? text.slice(0, colonIdx + 1) : ''
          const rest = colonIdx > -1 ? text.slice(colonIdx + 1) : text
          return (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span className="flex-1">
                {prefix && <strong className="text-violet-900">{prefix}</strong>}
                <span className="text-foreground/90">{rest}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
