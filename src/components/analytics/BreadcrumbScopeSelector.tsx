'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight, Building2, FolderKanban, FileText } from 'lucide-react'
import {
  BRAND_CATALOG,
  type ScopeType, type ScopeBreadcrumb,
} from '@/src/lib/scope-catalog'

interface Props {
  breadcrumb: ScopeBreadcrumb
}

function navigate(router: ReturnType<typeof useRouter>, scope: ScopeType, id: string) {
  router.push(`/analytics/${scope}/${id}`)
}

/**
 * 성과 분석 상단 3단 드롭다운 (브랜드 > 프로젝트 > 랜딩페이지)
 *
 * 동작:
 * - 브랜드 변경 → /analytics/brand/{id}
 * - 프로젝트 변경 → /analytics/project/{id}  ("전체 프로젝트" 선택 시 브랜드 수준으로 상승)
 * - 랜딩페이지 변경 → /analytics/event/{id}  ("전체 랜딩페이지" 선택 시 프로젝트 수준으로 상승)
 */
export function BreadcrumbScopeSelector({ breadcrumb }: Props) {
  const router = useRouter()
  const { brand, project, event, scope } = breadcrumb

  // 사용 가능한 옵션 추출
  const brandOptions = BRAND_CATALOG
  const projectOptions = brand?.projects ?? []
  const eventOptions = project?.events ?? brand?.projects.flatMap((p) => p.events) ?? []

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      {/* 브랜드 드롭다운 */}
      <div className="inline-flex items-center gap-1.5">
        <Building2 size={14} className="text-muted-foreground" />
        <select
          value={brand?.id ?? ''}
          onChange={(e) => navigate(router, 'brand', e.target.value)}
          className="rounded-md border border-border bg-white px-2.5 py-1.5 pr-8 text-sm font-semibold text-foreground hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%2212%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22currentColor%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22><polyline%20points=%226%209%2012%2015%2018%209%22/></svg>')] bg-[position:right_8px_center] bg-no-repeat"
        >
          {brandOptions.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <ChevronRight size={14} className="text-muted-foreground/50" />

      {/* 프로젝트 드롭다운 */}
      <div className="inline-flex items-center gap-1.5">
        <FolderKanban size={14} className="text-muted-foreground" />
        <select
          value={project?.id ?? '_all'}
          onChange={(e) => {
            const v = e.target.value
            if (v === '_all') {
              // 브랜드 수준으로
              if (brand) navigate(router, 'brand', brand.id)
            } else {
              navigate(router, 'project', v)
            }
          }}
          className="rounded-md border border-border bg-white px-2.5 py-1.5 pr-8 text-sm font-medium text-foreground hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%2212%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22currentColor%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22><polyline%20points=%226%209%2012%2015%2018%209%22/></svg>')] bg-[position:right_8px_center] bg-no-repeat"
        >
          <option value="_all">전체 프로젝트 ({projectOptions.length})</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <ChevronRight size={14} className="text-muted-foreground/50" />

      {/* 랜딩페이지 드롭다운 */}
      <div className="inline-flex items-center gap-1.5">
        <FileText size={14} className="text-muted-foreground" />
        <select
          value={event?.id ?? '_all'}
          onChange={(e) => {
            const v = e.target.value
            if (v === '_all') {
              // 프로젝트 수준으로 (프로젝트 없으면 브랜드로)
              if (project) navigate(router, 'project', project.id)
              else if (brand) navigate(router, 'brand', brand.id)
            } else {
              navigate(router, 'event', v)
            }
          }}
          className="rounded-md border border-border bg-white px-2.5 py-1.5 pr-8 text-sm font-medium text-foreground hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer appearance-none bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%2212%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22currentColor%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22><polyline%20points=%226%209%2012%2015%2018%209%22/></svg>')] bg-[position:right_8px_center] bg-no-repeat"
        >
          <option value="_all">
            전체 랜딩페이지 ({eventOptions.length})
          </option>
          {eventOptions.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {/* 현재 스코프 배지 */}
      <span className={`ml-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
        scope === 'event' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
        scope === 'project' ? 'bg-sky-50 text-sky-700 border-sky-200' :
        'bg-primary/10 text-primary border-primary/20'
      }`}>
        {scope === 'event' ? '랜딩페이지' : scope === 'project' ? '프로젝트' : '브랜드'} 기준
      </span>
    </div>
  )
}
