'use client';

import { useEffect, useState } from 'react';
import { ChannelIcon } from '@/src/components/ui/ChannelIcon';
import type { IntegrationStatus, AnalyticsIntegrationStatus, AdChannel } from '@/src/lib/ad-data';
import { BarChart3 } from 'lucide-react';

const ENV_HINTS: Record<AdChannel, string[]> = {
  google: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_ADS_REFRESH_TOKEN'],
  meta: ['META_ADS_ACCESS_TOKEN', 'META_ADS_AD_ACCOUNT_ID'],
  naver: ['NAVER_SEARCHAD_API_KEY', 'NAVER_SEARCHAD_SECRET_KEY', 'NAVER_SEARCHAD_CUSTOMER_ID'],
  kakao: ['KAKAO_MOMENT_ACCESS_TOKEN', 'KAKAO_MOMENT_AD_ACCOUNT_ID'],
  tiktok: ['TIKTOK_ADS_ACCESS_TOKEN', 'TIKTOK_ADS_ADVERTISER_ID'],
  karrot: ['DANGGEUN_BIZ_API_BASE', 'DANGGEUN_BIZ_ACCESS_TOKEN', 'DANGGEUN_BIZ_ACCOUNT_ID'],
};

const DOC_LINKS: Partial<Record<AdChannel, { label: string; url: string }>> = {
  google: { label: 'Google Ads API', url: 'https://developers.google.com/google-ads/api' },
  meta: { label: 'Meta Marketing API', url: 'https://developers.facebook.com/docs/marketing-apis/' },
  naver: { label: 'Naver SearchAd API', url: 'https://naver.github.io/searchad-apidoc/' },
  kakao: { label: 'Kakao Moment API', url: 'https://business.kakao.com/info/moment/' },
  tiktok: { label: 'TikTok for Business API', url: 'https://business-api.tiktok.com/portal/docs' },
  karrot: { label: '당근 비즈 (파트너 요청 필요)', url: 'https://business.daangn.com/' },
};

const GA4_ENV = ['GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_KEY (또는 Workload Identity)'];

export default function IntegrationsPage() {
  const [media, setMedia] = useState<IntegrationStatus[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsIntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ad-performance?view=integrations')
      .then((r) => r.json())
      .then((d) => {
        setMedia(d.integrations || []);
        setAnalytics(d.analytics || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">데이터 연결</h1>
          <p className="text-sm text-muted-foreground mt-1">
            광고 매체 · 분석 도구를 연결하면 실데이터가 통합됩니다. 미연결 시 시뮬레이션 데이터로 표시됩니다.
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">로딩 중...</div>
        ) : (
          <>
            {/* 광고 매체 */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">광고 매체 ({media.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {media.map((it) => (
                  <div key={it.channel} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <ChannelIcon channel={it.channel} size={32} />
                        <div>
                          <p className="font-semibold">{it.label}</p>
                          <p className="text-xs text-muted-foreground">{it.description}</p>
                        </div>
                      </div>
                      <span className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${it.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {it.connected ? '연결됨' : '시뮬레이션'}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 mb-3">
                      <p className="text-muted-foreground font-medium">필요 환경변수:</p>
                      <div className="flex flex-wrap gap-1">
                        {ENV_HINTS[it.channel]?.map((env) => (
                          <code key={env} className="rounded bg-muted px-2 py-0.5">{env}</code>
                        ))}
                      </div>
                    </div>

                    {DOC_LINKS[it.channel] && (
                      <p className="text-xs mb-2">
                        <a href={DOC_LINKS[it.channel]!.url} target="_blank" rel="noreferrer"
                           className="text-primary hover:underline">
                          📘 {DOC_LINKS[it.channel]!.label}
                        </a>
                      </p>
                    )}

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
            </section>

            {/* 분석 도구 */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">분석 도구 ({analytics.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analytics.map((it) => (
                  <div key={it.key} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                          <BarChart3 size={18} />
                        </div>
                        <div>
                          <p className="font-semibold">{it.label}</p>
                          <p className="text-xs text-muted-foreground">{it.description}</p>
                        </div>
                      </div>
                      <span className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${it.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {it.connected ? '연결됨' : '시뮬레이션'}
                      </span>
                    </div>
                    <div className="text-xs space-y-1 mb-3">
                      <p className="text-muted-foreground font-medium">필요 환경변수:</p>
                      <div className="flex flex-wrap gap-1">
                        {GA4_ENV.map((env) => (
                          <code key={env} className="rounded bg-muted px-2 py-0.5">{env}</code>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs mb-2">
                      <a href="https://developers.google.com/analytics/devguides/reporting/data/v1"
                         target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        📘 GA4 Data API 문서
                      </a>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      💡 GA4는 매체 API가 아니므로 허가 IP 제약 없이 Vercel 서버리스에서 직접 호출 가능합니다.
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">💡 안전한 API 키 주입 방법</p>
          <p className="mb-2">
            <strong className="text-foreground">매체 API</strong>: 허가 IP(222.109.27.119)에서만 호출 가능 — Vercel 서버리스에서 직접 호출 금지.
            사내 IP 장비 배치 수집 → DB 적재 → 웹은 DB에서만 읽는 패턴 권장.
          </p>
          <p>
            <strong className="text-foreground">시크릿 주입</strong>: <code>.env.local</code> 직접 편집 또는 Vercel 대시보드 Environment Variables.
            CLI 사용 시 <code>printf '%s' 'secret' | vercel env add KEY prod</code> 패턴은 allow 리스트에 기록되므로,
            <code>vercel env add KEY prod &lt; /tmp/secret.txt</code> 방식 권장.
          </p>
        </div>
      </div>
    </div>
  );
}
