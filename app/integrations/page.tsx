'use client';

import { useEffect, useState } from 'react';
import { CHANNEL_COLOR, type IntegrationStatus } from '@/src/lib/ad-data';

const ENV_HINTS: Record<string, string[]> = {
  google: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_ADS_REFRESH_TOKEN'],
  meta: ['META_ADS_ACCESS_TOKEN', 'META_ADS_AD_ACCOUNT_ID'],
  naver: ['NAVER_SEARCHAD_API_KEY', 'NAVER_SEARCHAD_SECRET', 'NAVER_SEARCHAD_CUSTOMER_ID'],
  kakao: ['KAKAO_MOMENT_ACCESS_TOKEN', 'KAKAO_MOMENT_AD_ACCOUNT_ID'],
};

export default function IntegrationsPage() {
  const [items, setItems] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ad-performance?view=integrations')
      .then((r) => r.json())
      .then((d) => { setItems(d.integrations || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">광고매체 API 연결</h1>
          <p className="text-sm text-muted-foreground mt-1">
            각 매체 API 키를 환경변수로 설정하면 실 데이터가 연동됩니다. 미연결 시 시뮬레이션 데이터가 표시됩니다.
          </p>
        </div>


        {loading ? (
          <div className="py-20 text-center text-muted-foreground">로딩 중...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((it) => (
              <div key={it.channel} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[it.channel] }} />
                    <div>
                      <p className="font-semibold">{it.label}</p>
                      <p className="text-xs text-muted-foreground">{it.description}</p>
                    </div>
                  </div>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${it.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {it.connected ? '연결됨' : '시뮬레이션'}
                  </span>
                </div>

                <div className="text-xs space-y-1 mb-3">
                  <p className="text-muted-foreground font-medium">필요 환경변수:</p>
                  <div className="flex flex-wrap gap-1">
                    {(ENV_HINTS[it.channel] || []).map((env) => (
                      <code key={env} className="rounded bg-muted px-2 py-0.5">{env}</code>
                    ))}
                  </div>
                </div>

                {it.connected && it.lastSyncAt && (
                  <p className="text-xs text-muted-foreground">최근 동기화: {new Date(it.lastSyncAt).toLocaleString('ko-KR')}</p>
                )}

                <button
                  className="mt-3 w-full text-sm rounded-md border border-border py-1.5 hover:bg-muted disabled:opacity-50"
                  disabled={!it.connected}
                  onClick={() => alert(`${it.label} 동기화 요청 (mock)`)}
                >
                  {it.connected ? '지금 동기화' : 'API 키 설정 필요'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">💡 실 데이터 연동 안내</p>
          <p>
            <code>.env.local</code>에 위 환경변수를 추가하면 <code>src/lib/ad-data.ts</code>의 데이터 페치 로직이
            실제 매체 API를 호출하도록 구성되어 있습니다. 현재는 시뮬레이션 데이터로 동작합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
