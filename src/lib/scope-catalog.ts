/**
 * 성과 분석 범위(Scope) 카탈로그
 *
 * 데이터 계층:
 *   브랜드 (Brand) > 프로젝트 (Project) > 랜딩페이지 (Event)
 *
 * Phase 1: 하드코딩 (실 이벤트 1042 더블어스 · 3550 굿리치 기반)
 * Phase 2: DB 연동 시 이 파일 구조 유지하고 본문만 실 쿼리로 교체
 */

export type ScopeType = 'brand' | 'project' | 'event'

export interface EventCatalog {
  id: string                      // eventId (e.g., '1042', '3550')
  name: string                    // 랜딩페이지 표시명
  projectId: string
  legacySlug?: string
  /** 실데이터 기준 기간 — 분석 기본 날짜 범위 힌트. */
  defaultDateRange?: { startDate: string; endDate: string }
}

export interface ProjectCatalog {
  id: string
  name: string
  brandId: string
  events: EventCatalog[]
  /** 프로젝트 대표 기간 — 포함 이벤트 중 가장 넓은 범위. */
  defaultDateRange?: { startDate: string; endDate: string }
}

export interface BrandCatalog {
  id: string
  name: string
  projects: ProjectCatalog[]
  /** 브랜드 대표 기간. */
  defaultDateRange?: { startDate: string; endDate: string }
}

// ───── 하드코딩 카탈로그 ─────
// Phase 1: 위픽 코퍼레이션 브랜드 + 2개 프로젝트 + 2개 이벤트
export const BRAND_CATALOG: BrandCatalog[] = [
  {
    id: 'wepick',
    name: '위픽 코퍼레이션',
    defaultDateRange: { startDate: '2026-03-01', endDate: '2026-04-21' },
    projects: [
      {
        id: 'doubleearth',
        name: '더블어스 렌탈',
        brandId: 'wepick',
        defaultDateRange: { startDate: '2026-03-01', endDate: '2026-03-31' },
        events: [
          {
            id: '1042',
            name: '타이어 렌탈 (nexentire_rental)',
            projectId: 'doubleearth',
            legacySlug: 'nexentire_rental',
            defaultDateRange: { startDate: '2026-03-01', endDate: '2026-03-31' },
          },
        ],
      },
      {
        id: 'goodrich',
        name: '굿리치 보험 상담',
        brandId: 'wepick',
        defaultDateRange: { startDate: '2026-03-22', endDate: '2026-04-21' },
        events: [
          {
            id: '3550',
            name: '(주)굿리치 · 보험 상담 신청',
            projectId: 'goodrich',
            defaultDateRange: { startDate: '2026-03-22', endDate: '2026-04-21' },
          },
        ],
      },
    ],
  },
]

/** 기본 브랜드 (URL 접근 없을 때 랜딩). */
export const DEFAULT_BRAND_ID = 'wepick'

// ───── 조회 헬퍼 ─────

export function getBrand(brandId: string): BrandCatalog | null {
  return BRAND_CATALOG.find((b) => b.id === brandId) ?? null
}

export function getProject(projectId: string): ProjectCatalog | null {
  for (const b of BRAND_CATALOG) {
    const p = b.projects.find((p) => p.id === projectId)
    if (p) return p
  }
  return null
}

export function getEvent(eventId: string): EventCatalog | null {
  for (const b of BRAND_CATALOG) {
    for (const p of b.projects) {
      const e = p.events.find((e) => e.id === eventId)
      if (e) return e
    }
  }
  return null
}

/** scope/id 에 해당하는 모든 이벤트 반환 (집계 대상). */
export function getEventsForScope(scope: ScopeType, id: string): EventCatalog[] {
  if (scope === 'event') {
    const e = getEvent(id)
    return e ? [e] : []
  }
  if (scope === 'project') {
    const p = getProject(id)
    return p?.events ?? []
  }
  if (scope === 'brand') {
    const b = getBrand(id)
    return (b?.projects ?? []).flatMap((p) => p.events)
  }
  return []
}

export interface ScopeBreadcrumb {
  scope: ScopeType
  id: string
  brand: BrandCatalog | null
  project: ProjectCatalog | null
  event: EventCatalog | null
  title: string          // 화면 타이틀
  subtitle: string       // 부제 (하위 개수 요약)
}

export function resolveBreadcrumb(scope: ScopeType, id: string): ScopeBreadcrumb | null {
  if (scope === 'event') {
    const event = getEvent(id)
    if (!event) return null
    const project = getProject(event.projectId)
    const brand = project ? getBrand(project.brandId) : null
    return {
      scope, id,
      brand, project, event,
      title: event.name,
      subtitle: `${brand?.name ?? '브랜드'} > ${project?.name ?? '프로젝트'}`,
    }
  }
  if (scope === 'project') {
    const project = getProject(id)
    if (!project) return null
    const brand = getBrand(project.brandId)
    return {
      scope, id,
      brand, project, event: null,
      title: project.name,
      subtitle: `${brand?.name ?? '브랜드'} · 랜딩페이지 ${project.events.length}개`,
    }
  }
  if (scope === 'brand') {
    const brand = getBrand(id)
    if (!brand) return null
    const totalEvents = brand.projects.reduce((s, p) => s + p.events.length, 0)
    return {
      scope, id,
      brand, project: null, event: null,
      title: brand.name,
      subtitle: `프로젝트 ${brand.projects.length}개 · 랜딩페이지 ${totalEvents}개`,
    }
  }
  return null
}

/** 기본 날짜 범위 계산 — scope/id 에 해당하는 이벤트들의 최소 시작 ~ 최대 종료. */
export function defaultDateRangeForScope(scope: ScopeType, id: string): { startDate: string; endDate: string } {
  const events = getEventsForScope(scope, id)
  if (events.length === 0) {
    const today = new Date()
    const end = today.toISOString().slice(0, 10)
    const start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return { startDate: start, endDate: end }
  }
  const ranges = events.map((e) => e.defaultDateRange).filter(Boolean) as Array<NonNullable<EventCatalog['defaultDateRange']>>
  if (ranges.length === 0) {
    const today = new Date()
    const end = today.toISOString().slice(0, 10)
    const start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return { startDate: start, endDate: end }
  }
  const minStart = ranges.reduce((a, r) => (r.startDate < a ? r.startDate : a), ranges[0].startDate)
  const maxEnd = ranges.reduce((a, r) => (r.endDate > a ? r.endDate : a), ranges[0].endDate)
  return { startDate: minStart, endDate: maxEnd }
}
