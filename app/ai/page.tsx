'use client';

import { Sparkles } from 'lucide-react';
import { AdAiQueryBox } from '@/src/components/ui/AdAiQueryBox';

export default function AdAiPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-gradient text-white flex items-center justify-center shadow-sm flex-shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl font-bold">
                <span className="lowercase">ai</span> <span className="text-brand-gradient">MAX</span>
              </h1>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
                Full-Funnel AI
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              광고 성과부터 상담 · 최종 예약까지 풀 퍼널을 실시간 통합 분석
            </p>
          </div>
        </div>


        <AdAiQueryBox />
      </div>
    </div>
  );
}
