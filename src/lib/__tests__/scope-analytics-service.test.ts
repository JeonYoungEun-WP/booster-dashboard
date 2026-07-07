import { describe, it, expect } from 'vitest'
import { mergeByTrackingCode, mergeByChannel } from '@/src/lib/scope-analytics-service'
import type { EventAnalyticsResponse } from '@/src/lib/event-analytics-service'

type CodeRow = EventAnalyticsResponse['byTrackingCode'][0]
type ChannelRow = EventAnalyticsResponse['byChannel'][0]

// 테스트용 행 생성 헬퍼 — 파생 지표는 실제 코드가 재계산하므로 입력값으로만 의미 있음
function codeRow(partial: Partial<CodeRow> & { trackingCode: string }): CodeRow {
  return {
    adSpend: 0, impressions: 0, clicks: 0, leads: 0, reservations: 0, contracts: 0,
    cpa_lead: 0, costPerReservation: 0, costPerContract: 0, contractROAS: 0,
    ...partial,
  }
}

function channelRow(partial: Partial<ChannelRow> & { channel: string }): ChannelRow {
  return {
    adSpend: 0, impressions: 0, clicks: 0, leads: 0, reservations: 0, contracts: 0,
    revenue: 0, cpa_lead: 0, cpa_reservation: 0, cpa_contract: 0, roas: 0,
    ...partial,
  } as ChannelRow
}

describe('mergeByTrackingCode', () => {
  it('같은 코드는 카운터를 합산하고 파생 지표를 재계산한다', () => {
    // 이벤트 A: 지출 100만, 계약 1, ROAS 1.5 (매출 150만 역산)
    const a = [codeRow({ trackingCode: 'X1', adSpend: 1_000_000, leads: 10, reservations: 5, contracts: 1, contractROAS: 1.5 })]
    // 이벤트 B: 지출 50만, 계약 1, ROAS 3.0 (매출 150만 역산)
    const b = [codeRow({ trackingCode: 'X1', adSpend: 500_000, leads: 5, reservations: 2, contracts: 1, contractROAS: 3.0 })]

    const merged = mergeByTrackingCode(a, b)
    expect(merged).toHaveLength(1)
    const row = merged[0]
    expect(row.adSpend).toBe(1_500_000)
    expect(row.leads).toBe(15)
    expect(row.reservations).toBe(7)
    expect(row.contracts).toBe(2)
    // ROAS = (150만+150만) / 150만 = 2.0 — 단순 평균(2.25)이 아니라 매출합 ÷ 지출합
    expect(row.contractROAS).toBeCloseTo(2.0)
    expect(row.cpa_lead).toBeCloseTo(100_000)
    expect(row.costPerContract).toBeCloseTo(750_000)
  })

  it('같은 코드가 3개 이벤트에 걸쳐도 정확하다 (기존 find 참조 버그 회귀 방지)', () => {
    const a = [codeRow({ trackingCode: 'X1', adSpend: 100, contracts: 1, contractROAS: 1 })]   // 매출 100
    const b = [codeRow({ trackingCode: 'X1', adSpend: 100, contracts: 1, contractROAS: 2 })]   // 매출 200
    const c = [codeRow({ trackingCode: 'X1', adSpend: 100, contracts: 1, contractROAS: 3 })]   // 매출 300

    const merged = mergeByTrackingCode(mergeByTrackingCode(a, b), c)
    expect(merged[0].adSpend).toBe(300)
    // (100+200+300) / 300 = 2.0
    expect(merged[0].contractROAS).toBeCloseTo(2.0)
  })

  it('지출 0 코드에서 0으로 나누지 않는다', () => {
    const a = [codeRow({ trackingCode: 'FREE', adSpend: 0, leads: 3, contracts: 1, contractROAS: 0 })]
    const merged = mergeByTrackingCode(a, [])
    expect(merged[0].contractROAS).toBe(0)
    expect(merged[0].cpa_lead).toBe(0)
    expect(Number.isFinite(merged[0].costPerContract)).toBe(true)
  })

  it('코드가 겹치지 않으면 각각 보존하고 지출 내림차순 정렬한다', () => {
    const a = [codeRow({ trackingCode: 'A1', adSpend: 100 })]
    const b = [codeRow({ trackingCode: 'B1', adSpend: 900 })]
    const merged = mergeByTrackingCode(a, b)
    expect(merged.map((r) => r.trackingCode)).toEqual(['B1', 'A1'])
  })
})

describe('mergeByChannel', () => {
  it('같은 채널은 카운터·매출을 합산 후 비율을 재계산한다', () => {
    const a = [channelRow({ channel: 'meta', adSpend: 1_000_000, leads: 50, reservations: 10, contracts: 2, revenue: 3_000_000 })]
    const b = [channelRow({ channel: 'meta', adSpend: 500_000, leads: 25, reservations: 5, contracts: 1, revenue: 1_500_000 })]

    const merged = mergeByChannel(a, b)
    expect(merged).toHaveLength(1)
    const row = merged[0]
    expect(row.adSpend).toBe(1_500_000)
    expect(row.leads).toBe(75)
    expect(row.contracts).toBe(3)
    expect(row.revenue).toBe(4_500_000)
    // ROAS = 450만 / 150만 = 3.0 (합산 후 재계산)
    expect(row.roas).toBeCloseTo(3.0)
    expect(row.cpa_lead).toBeCloseTo(20_000)
  })

  it('채널이 다르면 병합하지 않고 리드 내림차순 정렬한다', () => {
    const a = [channelRow({ channel: 'meta', leads: 10 })]
    const b = [channelRow({ channel: 'tiktok', leads: 99 })]
    const merged = mergeByChannel(a, b)
    expect(merged.map((r) => r.channel)).toEqual(['tiktok', 'meta'])
  })
})
