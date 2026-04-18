'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [workspaceName, setWorkspaceName] = useState('위픽부스터');
  const [brandColor, setBrandColor] = useState('#8b5cf6');
  const [websiteUrl, setWebsiteUrl] = useState('https://booster.im');

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">설정</h1>
          <p className="text-sm text-muted-foreground mt-1">워크스페이스 · 멤버 · 리포트 브랜딩 (개발 중)</p>
        </div>

        {/* 워크스페이스 */}
        <section className="rounded-xl border border-border bg-card p-6 mb-4">
          <h2 className="font-semibold mb-4">워크스페이스</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">이름</label>
              <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)}
                     className="w-full rounded border border-border px-3 py-2 bg-background" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">언어</label>
              <select className="w-full rounded border border-border px-3 py-2 bg-background">
                <option>한국어</option>
                <option>English</option>
              </select>
            </div>
          </div>
        </section>

        {/* 멤버 */}
        <section className="rounded-xl border border-border bg-card p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">멤버</h2>
            <button className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-muted">초대</button>
          </div>
          <div className="rounded-md border border-border divide-y divide-border">
            <div className="flex items-center justify-between p-3 text-sm">
              <div>
                <p className="font-medium">youngeun@wepick.kr</p>
                <p className="text-xs text-muted-foreground">관리자</p>
              </div>
              <span className="text-xs text-muted-foreground">나</span>
            </div>
          </div>
        </section>

        {/* 리포트 브랜딩 */}
        <section className="rounded-xl border border-border bg-card p-6 mb-4">
          <h2 className="font-semibold mb-4">PDF 리포트 브랜딩</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">회사 로고 (SVG/JPG/PNG, 최대 5MB)</label>
              <div className="h-24 rounded-md border-2 border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                로고 업로드 (준비 중)
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">웹사이트 URL</label>
                <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
                       className="w-full rounded border border-border px-3 py-2 bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">브랜드 색상</label>
                <div className="flex gap-2">
                  <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
                         className="w-10 h-10 rounded border border-border cursor-pointer" />
                  <input value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
                         className="flex-1 rounded border border-border px-3 py-2 bg-background font-mono text-sm" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center mt-6">
          ⚙️ 전체 설정 기능은 Adriel 벤치마크 기준으로 단계적으로 추가됩니다.
        </p>
      </div>
    </div>
  );
}
