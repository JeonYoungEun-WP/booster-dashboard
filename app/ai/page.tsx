'use client';

import { AdAiQueryBox } from '@/src/components/ui/AdAiQueryBox';

export default function AdAiPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">AI 광고 성과 분석</h1>
          <p className="text-sm text-muted-foreground mt-1">광고매체 통합 데이터를 실시간으로 조회하여 대화형으로 분석합니다</p>
        </div>


        <AdAiQueryBox />
      </div>
    </div>
  );
}
