'use client'

import { Sparkles, BarChart3, MousePointerClick, FileText } from 'lucide-react'

export interface SuggestedQuestion {
  label: string
  category: '광고' | '상담' | '예약' | '통합'
}

// 부스터맥스 광고 도메인 — 풀퍼널 예시 질문
const SUGGESTED: SuggestedQuestion[] = [
  { label: '이벤트 1042 풀퍼널 진단해줘', category: '통합' },
  { label: '이벤트 3550 채널별 광고비 대비 최종 예약 ROAS', category: '통합' },
  { label: '채널별 CPA(리드) · CPA(예약) · CPA(결제) 표로', category: '통합' },
  { label: '상담 → 예약 전환율 낮은 광고세트 TOP 3', category: '상담' },
  { label: '리드는 많은데 최종 결제가 안 나오는 트래킹코드', category: '예약' },
  { label: 'Meta vs TikTok 풀 퍼널 비교', category: '광고' },
  { label: '광고비 재분배 시뮬레이션 (효율 낮은 세트 차감)', category: '광고' },
  { label: '최근 7일 일자별 리드·예약·결제 추이', category: '예약' },
]

const CATEGORY_ICON = {
  광고: BarChart3,
  상담: MousePointerClick,
  예약: FileText,
  통합: Sparkles,
}

const CATEGORY_COLOR = {
  광고: 'bg-sky-50 text-sky-700 border-sky-200',
  상담: 'bg-amber-50 text-amber-700 border-amber-200',
  예약: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  통합: 'bg-violet-50 text-violet-700 border-violet-200',
}

interface Props {
  onPick: (question: string) => void
}

export function SuggestedQuestions({ onPick }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {SUGGESTED.map((q, i) => {
        const Icon = CATEGORY_ICON[q.category]
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPick(q.label)}
            className="group flex items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-left hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
          >
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${CATEGORY_COLOR[q.category]}`}>
              <Icon size={11} /> {q.category}
            </span>
            <span className="text-sm leading-relaxed text-foreground group-hover:text-foreground/90">
              {q.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
