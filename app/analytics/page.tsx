import Link from 'next/link'
import { ArrowRight, Calendar } from 'lucide-react'
import {
  EVENT_1042_PERIOD, EVENT_1042_TOTALS, EVENT_1042_REVENUE,
} from '@/src/lib/real-data/event-1042'
import {
  EVENT_3550_PERIOD, EVENT_3550_TOTALS, EVENT_3550_REVENUE, EVENT_3550_LEGACY_SLUG,
} from '@/src/lib/real-data/event-3550'

interface EventCard {
  eventId: string
  advertiser: string
  campaignTitle: string
  period: { startDate: string; endDate: string }
  channels: string[]
  landingPath: string
  legacySlug?: string
  kpi: { spend: number; leads: number; visitReservations: number; reservations: number; revenue: number; roas: number }
  visitLabel: '방문예약' | '예약'
  contractLabel: '결제' | '계약'
}

const EVENTS: EventCard[] = [
  {
    eventId: '1042',
    advertiser: '더블어스',
    campaignTitle: '눈밑지방재배치 39,59',
    period: EVENT_1042_PERIOD,
    channels: ['Meta'],
    landingPath: '/tasks/8426',
    legacySlug: 'doubleus',
    kpi: {
      spend: EVENT_1042_TOTALS.spend,
      leads: EVENT_1042_TOTALS.acquiredLeads,
      visitReservations: EVENT_1042_REVENUE.visitReservationCount,
      reservations: EVENT_1042_REVENUE.reservationCount,
      revenue: EVENT_1042_REVENUE.totalRevenue,
      roas: EVENT_1042_REVENUE.totalRevenue / EVENT_1042_TOTALS.spend,
    },
    visitLabel: '방문예약',
    contractLabel: '결제',
  },
  {
    eventId: '3550',
    advertiser: '(주)굿리치',
    campaignTitle: '굿리치 보험료 절감',
    period: EVENT_3550_PERIOD,
    channels: ['Meta', 'TikTok'],
    landingPath: '/tasks/11924',
    legacySlug: EVENT_3550_LEGACY_SLUG,
    kpi: {
      spend: EVENT_3550_TOTALS.spend,
      leads: EVENT_3550_TOTALS.acquiredLeads,
      visitReservations: EVENT_3550_REVENUE.visitReservationCount,
      reservations: EVENT_3550_REVENUE.reservationCount,
      revenue: EVENT_3550_REVENUE.totalRevenue,
      roas: EVENT_3550_REVENUE.totalRevenue / EVENT_3550_TOTALS.spend,
    },
    visitLabel: '예약',
    contractLabel: '계약',
  },
]

function fmtKRW(n: number): string {
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `₩${(n / 10_000).toFixed(0)}만`
  return `₩${n.toLocaleString('ko-KR')}`
}
function fmtNumber(n: number): string {
  return n.toLocaleString('ko-KR')
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

export default function AnalyticsIndexPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <h1 className="text-2xl font-bold">이벤트 분석</h1>
          <p className="text-sm text-muted-foreground mt-1">
            이벤트별 풀 퍼널(노출 → 클릭 → 리드 → 예약 → 결제)을 확인하세요.
            매체 API 자동 연동 전까지 광고주 제공 실데이터를 하드코딩합니다.
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {EVENTS.map((ev) => {
            const href = ev.legacySlug
              ? `/analytics/${ev.eventId}?legacySlug=${ev.legacySlug}`
              : `/analytics/${ev.eventId}`
            return (
              <Link
                key={ev.eventId}
                href={href}
                className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">
                        #{ev.eventId}
                      </span>
                      {ev.channels.map((c) => (
                        <span key={c} className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          {c}
                        </span>
                      ))}
                    </div>
                    <h2 className="text-lg font-bold">{ev.advertiser}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{ev.campaignTitle}</p>
                  </div>
                  <ArrowRight
                    size={18}
                    className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                  <Calendar size={12} />
                  {ev.period.startDate} ~ {ev.period.endDate}
                  <span className="ml-auto font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                    heypick.co.kr{ev.landingPath}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  <Kpi label="광고비" value={fmtKRW(ev.kpi.spend)} />
                  <Kpi label="리드" value={fmtNumber(ev.kpi.leads)} />
                  <Kpi label={ev.visitLabel} value={fmtNumber(ev.kpi.visitReservations)} />
                  <Kpi label={ev.contractLabel} value={fmtNumber(ev.kpi.reservations)} />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    <div className="text-[10px] text-muted-foreground">매출</div>
                    <div className="text-sm font-semibold">{fmtKRW(ev.kpi.revenue)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">ROAS</div>
                    <div className={`text-sm font-semibold ${ev.kpi.roas >= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {fmtPct(ev.kpi.roas)}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}
