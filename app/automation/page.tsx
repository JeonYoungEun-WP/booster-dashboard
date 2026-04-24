import { Bell, TrendingUp, Activity, Link2, Type, CheckCircle2 } from 'lucide-react';

const RULE_TYPES = [
  { icon: TrendingUp, title: '지표 임계값 모니터링', desc: 'CTR, CPA, ROAS 등 수치가 임계값을 넘거나 못 미치면 알림' },
  { icon: Activity, title: '시간 경과 지표 변경 추적', desc: '전기 대비 증감률이 기준 이상이면 알림' },
  { icon: Link2, title: '광고 계정 상태 추적', desc: '계정이 비활성·차단·연결 끊김 상태가 되면 알림' },
  { icon: Bell, title: 'UTM 파라미터 조건 확인', desc: 'UTM 누락, 특정 키워드 포함/미포함 감지' },
  { icon: Type, title: '광고 콘텐츠 키워드 모니터링', desc: '헤드라인·설명에 특정 키워드가 있는지 확인' },
  { icon: CheckCircle2, title: '광고 승인 상태 추적', desc: '광고·광고세트가 미승인 상태면 알림' },
];

export default function AutomationPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">자동화</h1>
          <p className="text-sm text-muted-foreground mt-1">지표·계정·콘텐츠 조건을 감시하고 이메일·Slack으로 알림 (개발 예정)</p>
        </div>

        <div className="rounded-xl border border-dashed border-border bg-gradient-to-br from-emerald-50 to-transparent p-6 mb-6">
          <p className="text-sm text-muted-foreground">
            자동화 룰 엔진은 현재 개발 중입니다. 아래 6가지 유형을 지원할 예정입니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {RULE_TYPES.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.title} className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Icon size={20} />
                </div>
                <p className="font-semibold mb-1">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
