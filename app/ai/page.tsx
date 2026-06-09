'use client'

import { Sparkles } from 'lucide-react'
import { Chat } from '@/src/components/chat/Chat'

export default function AdAiPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-gradient text-white flex items-center justify-center shadow-sm flex-shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl font-bold">
                <span className="lowercase">ai</span> <span className="text-brand-gradient">MAX</span>
              </h1>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
                Full-Funnel AI
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              광고 성과부터 상담 · 최종 예약까지 풀 퍼널을 실시간 통합 분석
            </p>
          </div>
        </div>

        <Chat />
      </div>
    </div>
  )
}
