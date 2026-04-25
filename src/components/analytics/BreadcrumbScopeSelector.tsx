'use client'

import { useRouter } from 'next/navigation'
import {
  ChevronRight, ChevronDown, Building2, FolderKanban, FileText, type LucideIcon,
} from 'lucide-react'
import {
  BRAND_CATALOG,
  type ScopeType, type ScopeBreadcrumb,
} from '@/src/lib/scope-catalog'

interface Props {
  breadcrumb: ScopeBreadcrumb
}

const SCOPE_LABEL: Record<ScopeType, string> = {
  brand: '브랜드',
  project: '프로젝트',
  event: '랜딩페이지',
}

function navigate(router: ReturnType<typeof useRouter>, scope: ScopeType, id: string) {
  router.push(`/analytics/${scope}/${id}`)
}

interface StepCardProps {
  level: ScopeType
  icon: LucideIcon
  active: boolean
  selectedValue: string
  options: Array<{ value: string; label: string }>
  allOptionLabel?: string
  onChange: (value: string) => void
}

function StepCard({
  level, icon: Icon, active, selectedValue, options, allOptionLabel, onChange,
}: StepCardProps) {
  const label = SCOPE_LABEL[level]
  return (
    <div
      className={`relative flex-1 min-w-[200px] rounded-xl border-2 p-3 transition-all ${
        active
          ? 'border-primary bg-primary/[0.04] shadow-sm ring-2 ring-primary/15'
          : 'border-border bg-white hover:border-primary/30 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={14} className={active ? 'text-primary' : 'text-muted-foreground'} strokeWidth={active ? 2.4 : 2} />
        <span className={`text-[11px] font-bold uppercase tracking-wider ${
          active ? 'text-primary' : 'text-muted-foreground'
        }`}>
          {label}
        </span>
        {active && (
          <span className="ml-auto inline-flex items-center text-[11px] bg-primary text-white rounded-full px-2 py-0.5 font-bold leading-none">
            현재 보는 중
          </span>
        )}
      </div>
      <div className="relative">
        <select
          value={selectedValue}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} 선택`}
          className={`w-full appearance-none rounded-lg border px-3 py-2 pr-9 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
            active
              ? 'border-primary/40 bg-white font-bold text-foreground hover:border-primary'
              : 'border-border bg-white font-medium text-foreground hover:border-primary/40'
          }`}
        >
          {allOptionLabel && (
            <option value="_all">{allOptionLabel}</option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
            active ? 'text-primary' : 'text-muted-foreground'
          }`}
          strokeWidth={2.2}
        />
      </div>
    </div>
  )
}

/**
 * 성과 분석 상단 3단 스코프 셀렉터 (브랜드 > 프로젝트 > 랜딩페이지)
 *
 * - 현재 분석 단계가 카드 단위로 강조 (primary 보더 + "현재 보는 중" 배지)
 * - 각 카드는 드롭다운 — 변경 시 해당 스코프로 라우팅 이동
 * - "전체 …" 옵션은 상위 스코프로 상승
 */
export function BreadcrumbScopeSelector({ breadcrumb }: Props) {
  const router = useRouter()
  const { brand, project, event, scope } = breadcrumb

  const brandOptions = BRAND_CATALOG.map((b) => ({ value: b.id, label: b.name }))
  const projectList = brand?.projects ?? []
  const projectOptions = projectList.map((p) => ({ value: p.id, label: p.name }))
  const eventList = project?.events ?? brand?.projects.flatMap((p) => p.events) ?? []
  const eventOptions = eventList.map((e) => ({ value: e.id, label: e.name }))

  const onBrandChange = (v: string) => navigate(router, 'brand', v)

  const onProjectChange = (v: string) => {
    if (v === '_all') {
      if (brand) navigate(router, 'brand', brand.id)
    } else {
      navigate(router, 'project', v)
    }
  }

  const onEventChange = (v: string) => {
    if (v === '_all') {
      if (project) navigate(router, 'project', project.id)
      else if (brand) navigate(router, 'brand', brand.id)
    } else {
      navigate(router, 'event', v)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* 헤더: 분석 범위 안내 + 현재 스코프 배지 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">분석 범위 선택</span>
          <span className="text-xs text-muted-foreground">아래 리스트박스에서 단계를 변경하세요</span>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
          scope === 'event' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          scope === 'project' ? 'bg-sky-50 text-sky-700 border-sky-200' :
          'bg-primary/10 text-primary border-primary/30'
        }`}>
          현재: {SCOPE_LABEL[scope]} 기준
        </span>
      </div>

      {/* 3 단계 스텝 카드 */}
      <div className="flex items-stretch gap-2 flex-wrap md:flex-nowrap">
        <StepCard
          level="brand"
          icon={Building2}
          active={scope === 'brand'}
          selectedValue={brand?.id ?? ''}
          options={brandOptions}
          onChange={onBrandChange}
        />
        <div className="flex items-center text-muted-foreground/60 px-1 self-center">
          <ChevronRight size={20} />
        </div>
        <StepCard
          level="project"
          icon={FolderKanban}
          active={scope === 'project'}
          selectedValue={project?.id ?? '_all'}
          options={projectOptions}
          allOptionLabel={`전체 프로젝트 (${projectList.length})`}
          onChange={onProjectChange}
        />
        <div className="flex items-center text-muted-foreground/60 px-1 self-center">
          <ChevronRight size={20} />
        </div>
        <StepCard
          level="event"
          icon={FileText}
          active={scope === 'event'}
          selectedValue={event?.id ?? '_all'}
          options={eventOptions}
          allOptionLabel={`전체 랜딩페이지 (${eventList.length})`}
          onChange={onEventChange}
        />
      </div>
    </div>
  )
}
