import { describe, it, expect } from 'vitest'
import { parseCampaignTag, matchesEvent } from '@/src/lib/mapping'

describe('parseCampaignTag', () => {
  it('캠페인명에서 #{eventId}_{trackingCode} 토큰을 추출한다', () => {
    expect(parseCampaignTag('39만원_1 #1042_f1219M1')).toEqual({
      eventId: '1042',
      trackingCode: 'f1219M1',
    })
  })

  it('토큰이 2개면 첫 번째만 추출한다', () => {
    expect(parseCampaignTag('테스트 #1042_f1219M1 뒤에 #1159_qU1Ckk3Jfb')).toEqual({
      eventId: '1042',
      trackingCode: 'f1219M1',
    })
  })

  it('한글이 코드에 인접하면 영숫자 경계까지만 코드로 인식한다', () => {
    // 정규식 [A-Za-z0-9]+ 는 한글에서 멈추므로 한글은 제외됨
    expect(parseCampaignTag('#3550_gR8xPm21굿리치')).toEqual({
      eventId: '3550',
      trackingCode: 'gR8xPm21',
    })
  })

  it('매치되는 토큰이 없으면 null 을 반환한다', () => {
    expect(parseCampaignTag('39만원_1 브랜드캠페인')).toBeNull()
    // # 뒤가 숫자가 아니면 매치 안 됨
    expect(parseCampaignTag('#abc_f1219M1')).toBeNull()
    // 언더스코어 뒤 코드가 없으면 매치 안 됨
    expect(parseCampaignTag('#1042_')).toBeNull()
  })

  it('빈 문자열이면 null 을 반환한다', () => {
    expect(parseCampaignTag('')).toBeNull()
  })
})

describe('matchesEvent', () => {
  const tag = { eventId: '1042', trackingCode: 'f1219M1' }

  it('tag 가 null 이면 false', () => {
    expect(matchesEvent(null, '1042')).toBe(false)
  })

  it('eventId 가 일치하면 true (trackingCode 미지정)', () => {
    expect(matchesEvent(tag, '1042')).toBe(true)
  })

  it('eventId 가 불일치하면 false', () => {
    expect(matchesEvent(tag, '1159')).toBe(false)
  })

  it('trackingCode 를 지정하면 코드까지 일치해야 true', () => {
    expect(matchesEvent(tag, '1042', 'f1219M1')).toBe(true)
    expect(matchesEvent(tag, '1042', 'wrongCode')).toBe(false)
  })

  it('eventId 는 대소문자·정확 일치 (문자열 비교)', () => {
    expect(matchesEvent(tag, '104')).toBe(false)
    expect(matchesEvent(tag, '10420')).toBe(false)
  })
})
