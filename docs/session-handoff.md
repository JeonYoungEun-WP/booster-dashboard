# 세션 핸드오프 — 2026-04-22

이 문서는 집 컴퓨터 등 다른 PC 에서 이 프로젝트 작업을 이어받을 때 필요한 정보를 정리한 것입니다. `git pull` 이후 여기만 보고 셋업 가능하도록 작성.

---

## 🚀 빠른 시작 (집 PC 에서)

### 1. 레포 클론 + 의존성
```bash
git clone https://github.com/JeonYoungEun-WP/booster-dashboard.git
cd booster-dashboard
npm install
```

### 2. `.env.local` 생성 (gitignored)

프로젝트 루트에 `.env.local` 파일 만들고 아래 값을 채우세요. **`.env.example`** 에 전체 변수 목록과 주석이 있으니 참고.

| Key | Value |
|---|---|
| `GA4_PROPERTY_ID` | `436683873` |
| `GCP_PROJECT_NUMBER` | `384596964105` |
| `GCP_WORKLOAD_IDENTITY_POOL_ID` | `vercel` |
| `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | `vercel` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `ga4-heypick-reader@project-150ad5c5-0e90-4383-9bc.iam.gserviceaccount.com` |
| `CLARITY_PROJECT_ID` | `p0v1letcwq` |
| `CLARITY_API_TOKEN` | Vercel Dashboard 에서 복사 *(아래 참조)* |

**`CLARITY_API_TOKEN` 가져오는 법**:
1. https://vercel.com/wepick/booster-dashboard/settings/environment-variables 접속
2. `CLARITY_API_TOKEN` 항목 열고 **"Reveal"** 클릭 → 값 복사
3. `.env.local` 에 붙여넣기

만약 Vercel 에서 토큰이 숨김 상태고 조회 안 되면:
- Microsoft Clarity (https://clarity.microsoft.com) → `p0v1letcwq` 프로젝트 → Settings → Data Export → 기존 토큰 revoke + 새 토큰 생성 → Vercel + `.env.local` 양쪽 업데이트

### 3. 로컬 개발 서버
```bash
npm run dev            # http://localhost:3002
```

로컬 한계 — GA4 는 Vercel OIDC 기반 WIF 를 쓰므로 **로컬 dev 에서는 GA4 `unavailable`** 로 뜸. UI·광고·리드·Clarity 는 로컬에서도 작동. GA4 실데이터 확인은 항상 Vercel Production URL 로.

---

## 🔗 현재 배포 상태

- **최신 커밋**: `main` (푸시 후 Vercel 자동 배포)
- **Production URL**: Vercel Dashboard → Deployments 탭에서 최신 deployment URL 확인
- **데모 페이지**:
  - 이벤트 1042 (더블어스, 3월): `/analytics/1042` — 자동 default `legacySlug=doubleus`
  - 이벤트 3550 ((주)굿리치, 3/22~4/21): `/analytics/3550` — 자동 default `legacySlug=goodrich3`
- **GitHub**: https://github.com/JeonYoungEun-WP/booster-dashboard

---

## ✅ 지금까지 완성된 것

### 인프라
- [x] Workload Identity Federation (GCP ↔ Vercel OIDC) 완전 세팅
- [x] GA4 Data API (heypick 속성 `436683873`) 실데이터 조회
- [x] Microsoft Clarity Data Export API 어댑터 (캐시 60분)
- [x] Vercel 자동 배포 (main 푸시 시)

### 이벤트 1042 (더블어스) 풀 퍼널 대시보드
- [x] 6단계 퍼널: 노출 → 클릭 → 세션 → 리드 → 방문예약 → 결제 + 각 카드에 전환율·획득당 비용
- [x] 광고 실데이터 (2026-03 더블어스 10개 광고세트)
- [x] **실 리드 437건 타임스탬프** 반영 (광고주 제공)
- [x] 방문예약 41 / 결제 13 (더미) + 객단가 130만 + 매출 1,690만
- [x] 예약 매출 배수(ROAS) 187.3% 자동 계산
- [x] 일자별 추이 차트 (세션 선 / 리드·예약 막대)
- [x] 데이터 출처 뱃지 (🟢어드민 / 🔵GA / 🟡더미)
- [x] GA4 `/tasks/8426` 템플릿 경로 매칭 (쿼리스트링 제거 우회)

### 이벤트 3550 ((주)굿리치) 풀 퍼널 대시보드
- [x] 이벤트 1042 와 동일 구조, 다른 기간 (2026-03-22 ~ 2026-04-21)
- [x] 광고 실데이터 + 방문 2건 override + 채널별 집계
- [x] 레거시 슬러그 `goodrich3` 자동 주입
- [x] 템플릿 경로 `/tasks/19524`
- [x] GA4 미연동 — **GA 데이터는 더미** 로 채움
- [x] `src/lib/real-data/event-3550.ts` · `event-3550-leads.ts`

### 공통 UI 고도화
- [x] KPI 증감률 그리드 (전기 대비 ±% 표시)
- [x] 채널 도넛 차트 — 채널별 기여 시각화
- [x] 추이 차트 일/주/월 토글
- [x] 채널별 풀 퍼널 테이블 (FunnelMetricsTable)

### 파일 구조
```
app/
  analytics/[eventId]/page.tsx            ← 이벤트 단위 분석 페이지
  api/
    event-analytics/route.ts              ← 퍼널 통합 API
    ga4/page-debug/route.ts               ← GA4 pagePath 진단
    ga4/route.ts                          ← GA4 summary
    ad-performance/route.ts               ← 광고 채널 요약
src/
  components/analytics/
    FunnelFlow.tsx                        ← 6단계 퍼널 + 하단 4카드
    KpiGrid.tsx                           ← KPI + SourceBadge
    TrendChart.tsx                        ← ComposedChart (Line+Bar)
    TrackingCodeTable.tsx                 ← 광고세트별 성과
    SourceTable.tsx                       ← GA4 소스/매체
    AdChannelMini.tsx                     ← 채널별 광고 요약
    ClarityCard.tsx                       ← UX 인사이트
  lib/
    mapping.ts                            ← #{eventId}_{code} 파싱·필터
    ad-data.ts                            ← 광고 6채널 시뮬·캠페인 태그
    channels/
      ga4.ts                              ← WIF + Data API
      clarity.ts                          ← Export API + 캐시
      leads.ts                            ← 리드·예약 (더미+실 타임스탬프)
    real-data/
      event-1042.ts                       ← 더블어스 광고·매출 하드코딩
      event-1042-leads.ts                 ← 실 리드 타임스탬프 437건
```

---

## 🔄 진행 중 / 대기 작업

### 1. Clarity rate limit 회복 확인
마지막 조회 시 일 10회 호출 한도 초과로 `unavailable`. 하루 지나면 자동 회복. 캐시 TTL 60분으로 이미 확장해서 다시 한도 찰 가능성 낮음. 회복 후 이벤트 1042 페이지에서 Clarity 카드가 실데이터 표시하는지 확인.

### 2. 리드·예약 실 DB 연동 (Phase 2)
- 헤이픽/리드프로 리드 DB 접근 경로 미확정 (담당자 미정)
- 현재 `src/lib/channels/leads.ts` 는 더미/실 타임스탬프 혼합으로 동작
- 실 DB 연동 시 `leads.ts` 본문만 교체, 호출부·시그니처 유지

### 3. 이벤트 Sidebar 드롭다운 or 인덱스 페이지
- 현재 Sidebar 의 "이벤트" 메뉴가 `/analytics` 로 가지만 그 경로의 기본 페이지가 없음 (이벤트 ID 지정 필수)
- `/analytics` 루트에 이벤트 목록(1042, 3550, ...) 보여주는 인덱스 페이지 추가 고려
- 또는 Sidebar 에서 이벤트 드롭다운 (클릭 시 이벤트 선택 팝업)

### 4. 다른 이벤트 ID 확장
- GA4 Explore 에 보이는 11701·9812 등 추가 이벤트 지원
- 각 이벤트에 대해 `event-<id>.ts` + 템플릿 경로 매핑 + API override 분기 추가 필요
- 반복 패턴이라 공통 인터페이스로 리팩토링하면 유지보수 쉬움

### 5. 매체 실 광고비 연동
- 현재 모든 광고 데이터는 시뮬레이션 또는 이벤트별 하드코딩
- Vercel 서버리스에서 직접 호출 불가 (IP 제약)
- 사내 IP `222.109.27.119` 기반 수집 파이프라인 → DB 적재 → Vercel 조회 패턴 필요

---

## 🔑 외부 접근 정보

### GCP
- 조직: `youngeun-org`
- 프로젝트: `ga4-api-project` (ID: `project-150ad5c5-0e90-4383-9bc`, Number: `384596964105`)
- 서비스 계정: `ga4-heypick-reader@project-150ad5c5-0e90-4383-9bc.iam.gserviceaccount.com`
- Workload Identity Pool: `projects/384596964105/locations/global/workloadIdentityPools/vercel`
- OIDC Provider: `vercel` (Issuer: `https://oidc.vercel.com/wepick`)

### Vercel
- 팀: `wepick` (Hobby 플랜)
- 프로젝트: `booster-dashboard`
- Settings: https://vercel.com/wepick/booster-dashboard/settings
- OIDC Federation: Team mode 활성화 (aud: `https://vercel.com/wepick`)

### GA4
- 헤이픽 속성: `436683873` (heypick.co.kr)
- 접근 권한: `ga4-heypick-reader` SA (뷰어)

### Clarity
- 프로젝트: `p0v1letcwq` (heypick)
- 콘솔: https://clarity.microsoft.com/projects/view/p0v1letcwq/dashboard
- Data Export API: `https://www.clarity.ms/export-data/api/v1/project-live-insights`
- 한도: 일 10회 호출 / 최대 3일 과거 데이터

### GitHub
- 레포: https://github.com/JeonYoungEun-WP/booster-dashboard
- 배포 webhook: Vercel 자동 연결 (main 푸시 시 자동 배포)

---

## ⚠️ 기억해야 할 제약

### GCP 조직 정책
**`iam.disableServiceAccountKeyCreation`** 정책 적용 — 서비스 계정 JSON 키 **생성 불가**. GCP 인증은 반드시 WIF 또는 ADC 사용. 절대로 SA 키 방식으로 우회하려 하지 말 것.

### 매체 API IP 제약
실 매체 API (Google Ads / Meta / Naver / Kakao / TikTok / 당근) 는 사내 IP `222.109.27.119` 에서만 호출 가능. Vercel 서버리스 (동적 IP) 에서는 호출 차단되므로 현재 **시뮬레이션 폴백** 으로만 동작. 매체 실데이터 필요 시 사내 배치·크론 파이프라인 별도 구축 필요.

### Clarity 데이터 기간
Clarity Data Export API 는 **최근 3일** 만 조회 가능 (numOfDays=1/2/3). 3월 과거 데이터 재조회 불가. 과거 분석은 Clarity 웹 콘솔에서 직접 확인.

### `.env.local` 절대 커밋 금지
`.gitignore` 에 이미 포함돼 있지만, `git add .env*` 같은 명령 절대 금지. 실수로 추가되면 `git reset` 후 Clarity 토큰 revoke & regenerate.

---

## 📝 플랜 파일 위치

플랜 상세 (초기 설계): `C:/Users/wepick/.claude/plans/heypick-vercel-app-admin-analytics-rosy-meadow.md`

⚠️ 이 플랜 파일은 **현재 PC 의 개인 `.claude/plans/` 디렉토리** 에 있어서 집 PC 에는 없습니다. 필요하면 같이 옮기거나 이 핸드오프 문서가 대체.

---

## 🔧 집 PC 에서 첫 명령

```bash
# 1. 클론
git clone https://github.com/JeonYoungEun-WP/booster-dashboard.git ~/Desktop/booster-dashboard
cd ~/Desktop/booster-dashboard

# 2. 의존성
npm install

# 3. .env.local 생성 (위 표 참조)
cp .env.example .env.local
# 편집기로 열어서 값 채우기
# Windows: notepad .env.local
# macOS:   open -e .env.local  또는 code .env.local

# 4. dev 서버
npm run dev

# 5. 브라우저
# http://localhost:3002/analytics/1042?legacySlug=doubleus
```

로컬 GA4 는 `unavailable` 뜨지만 UI·광고 시뮬·리드·Clarity 는 정상 확인 가능.

실데이터 GA4 확인: https://booster-dashboard-hp71x8tbe-wepick.vercel.app/analytics/1042?legacySlug=doubleus
