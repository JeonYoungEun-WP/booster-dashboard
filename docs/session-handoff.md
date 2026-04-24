# 세션 핸드오프 — 2026-04-24

이 문서는 다른 PC 에서 이 프로젝트 작업을 이어받을 때 필요한 모든 정보입니다. **이것만 보고 셋업 + 맥락 복구 가능** 하도록 작성.

---

## 🚀 빠른 시작 (다른 PC 에서)

### 1. 클론 + 의존성
```bash
git clone https://github.com/JeonYoungEun-WP/booster-dashboard.git
cd booster-dashboard
npm install
```

### 2. `.env.local` 생성 (gitignored)

프로젝트 루트에 `.env.local` 만들고 아래 값 채우기.

| Key | Value |
|---|---|
| `GA4_PROPERTY_ID` | `436683873` |
| `GCP_PROJECT_NUMBER` | `384596964105` |
| `GCP_WORKLOAD_IDENTITY_POOL_ID` | `vercel` |
| `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | `vercel` |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `ga4-heypick-reader@project-150ad5c5-0e90-4383-9bc.iam.gserviceaccount.com` |
| `CLARITY_PROJECT_ID` | `p0v1letcwq` |
| `CLARITY_API_TOKEN` | Vercel Dashboard 에서 복사 *(아래 참조)* |
| `GOOGLE_GENERATIVE_AI_API_KEY` | AI 챗용 Gemini 키 — https://aistudio.google.com/app/apikey |

**`CLARITY_API_TOKEN` 가져오기**: https://vercel.com/wepick/booster-dashboard/settings/environment-variables → 해당 항목 "Reveal" → 복사.

### 3. 로컬 개발 서버
```bash
npm run dev            # http://localhost:3002
```

로컬 한계 — GA4 는 Vercel OIDC 기반 WIF 를 쓰므로 **로컬 dev 에서는 GA4 `unavailable`**. UI·광고 시뮬·리드·Clarity 는 로컬에서도 작동. GA4 실데이터 확인은 **Vercel Production URL 로만**.

---

## 🔗 현재 배포 상태 (2026-04-24)

- **최신 커밋**: `3fff4db` — 스코프 라우트 충돌 수정 (동적 세그먼트 충돌 해결)
- **Production URL**: Vercel Dashboard → Deployments 탭
- **GitHub**: https://github.com/JeonYoungEun-WP/booster-dashboard
- **데모 진입점**:
  - `/analytics` → 기본 브랜드 (위픽 코퍼레이션) 자동 리다이렉트
  - `/analytics/brand/wepick` — 브랜드 수준 집계
  - `/analytics/project/doubleearth` — 프로젝트 수준 집계
  - `/analytics/event/1042` — 더블어스 랜딩 (기존 단일 이벤트)
  - `/analytics/event/3550` — (주)굿리치 랜딩
  - `/analytics/1042` (레거시) → `/analytics/event/1042` 자동 리다이렉트
  - `/ai` — ai MAX 풀 퍼널 챗봇

---

## 🆕 최근 대형 변경 (2026-04-23 ~ 24)

### A. 성과 분석 스코프 구조 (브랜드 > 프로젝트 > 랜딩페이지)
| 커밋 | 내용 |
|---|---|
| `be62351` | 스코프 3단계 (브랜드/프로젝트/이벤트) 구조 신규 |
| `3fff4db` | `[eventId]` · `[scope]` 동적 세그먼트 충돌 해결 (레거시 리다이렉트 `next.config.ts` 로 이동) |

**데이터 계층** (`src/lib/scope-catalog.ts` — 하드코딩):
```
브랜드: 위픽 코퍼레이션 (wepick)
├── 프로젝트: 더블어스 렌탈 (doubleearth)
│   └── 랜딩페이지: 1042 (타이어 렌탈 · nexentire_rental)
└── 프로젝트: 굿리치 보험 상담 (goodrich)
    └── 랜딩페이지: 3550 ((주)굿리치 · 보험 상담 신청)
```

**집계 서비스** (`src/lib/scope-analytics-service.ts`):
- scope=event → 기존 `buildEventAnalytics` 그대로
- scope=project → 소속 이벤트 병렬 분석 후 합산
- scope=brand → 브랜드 내 모든 프로젝트·이벤트 합산
- funnel 카운터 합산 후 CTR/CPC/CPA/CVR/ROAS **재계산**
- byChannel·byTrackingCode·GA4 daily·leads byDate 모두 키 기반 합산

**UI**:
- `src/components/analytics/BreadcrumbScopeSelector.tsx` — 3단 드롭다운
  - 브랜드 ▼ › 프로젝트 ▼ › 랜딩페이지 ▼ + 현재 스코프 배지
  - "전체" 선택 시 상위 레벨로 상승
- `app/analytics/[scope]/[id]/page.tsx` — 단일 페이지 (scope 별 분기)
- `app/analytics/page.tsx` — `/analytics/brand/wepick` 로 redirect
- 사이드바 레이블: `이벤트` → `성과 분석`

### B. ai MAX (풀 퍼널 AI 분석)
| 커밋 | 내용 |
|---|---|
| `0b80c4f` | AI 광고 성과 분석 → ai MAX 리브랜딩 · 광고·상담·최종 예약 3 겹 분석 확장 |
| `89002bc` | tableData 도구 + GFM 표 스타일 — 비교 데이터 자동 표 출력 |
| `65e9723` | 이벤트 페이지 최상단 AI 진단 카드 (5 불릿) + /ai 링크 |

**시스템 프롬프트 핵심**:
- "세 겹 프레임" — 광고 성과 × 상담 성과 × 최종 예약 성과 통합
- "클릭 많은 광고 = 좋은 광고" ❌ → "광고비 1원당 결제 매출 회수" ⭕
- 표로 정리 가능한 데이터는 **반드시 tableData 도구** 로 출력
- 답변 템플릿: `[표] → 💡 인사이트 → 🎯 다음 액션`

**tableData 도구** (`app/api/ad-chat/route.ts`):
- format 옵션: `text` · `number` · `currency` · `percent` · `roas` · `code`
- footer (합계 행), highlightRule (`top-roas`/`bottom-roas`)
- 렌더러: `src/components/ui/AiTableBlock.tsx`

### C. 리포트 모드 (PPT · PDF · Excel)
| 커밋 | 내용 |
|---|---|
| `ab565de` | 이벤트 분석 페이지 상단 "리포트 모드" 버튼 + 다이얼로그 |
| `d0d7795` | PPT·PDF 슬라이드 디자인 대시보드와 통일 |
| `7a15dcf` | Excel 다운로드 추가 + 다이얼로그 간소화 |
| `93b2f45` | PPT 콤보 차트 복구 · 4페이지 도넛 + 퍼널 비교 표 · 소스 태그 제거 |
| `8cc6a0c` | Excel 브랜드 디자인 (xlsx-js-style) · 리드 막대 그린톤 · AI 표 우선 |

**파일**:
- `src/lib/report-builder-pptx.ts` — 8슬라이드 편집 가능 PPT (pptxgenjs)
- `src/lib/report-builder-pdf.ts` — PDF (jsPDF + html2canvas)
- `src/lib/report-builder-xlsx.ts` — 6시트 스타일 Excel (**xlsx-js-style**)
- `src/components/analytics/ReportModeDialog.tsx` — 3개 다운로드 버튼

**Excel 스타일** (xlsx-js-style 신규 도입 — community xlsx 는 style write 미지원):
- 헤더: 브랜드 그린 `#3ABA85` 배경 + 화이트 텍스트
- Zebra stripe (짝수 행 `#F8F9FC`)
- 합계 행: 연한 그린 `#E8F6EF` + bold
- 숫자 Excel 네이티브 포맷 (₩#,##0 / 0.00%)
- ROAS 자동 컬러 (1 이상 녹색, 미만 주황)
- 자동 필터

### D. 디자인 시스템 (call-convo-master design-guide 기반)
| 커밋 | 내용 |
|---|---|
| `038159a` | PPT·PDF·AI 진단 카드 브랜드 팔레트 |
| `f264d39` | globals.css HSL 토큰 · design-guide 기반 그린톤 적용 |
| `8cc6a0c` | 리드 막대 오렌지 → 브랜드 그린 |

**팔레트** (출처: https://call-convo-master.vercel.app/design-guide):
| 토큰 | HSL | HEX |
|---|---|---|
| primary | 157 52% 48% | #3ABA85 |
| primary-gradient-from | 141 53% 63% | #65CC91 |
| primary-gradient-to | 214 93% 68% | #5FA8FA |
| success | 142 71% 45% | #22C55E |
| warning | 38 92% 50% | #F59E0B |
| radius | 0.5rem | — |

**그라디언트**: `linear-gradient(135deg, #65CC91, #5FA8FA)` (그린 → 블루)
**유틸 클래스**: `.bg-brand-gradient`, `.text-brand-gradient` (globals.css)

**매체 색상 보존** — Meta #1877F2, Google #4285F4, Naver #03C75A, Kakao #FEE500, TikTok #000000, 당근 #FF7E1D 는 `src/lib/ad-data.ts` + 리포트 빌더의 `CHANNEL_COLORS` 맵에서 **변경 없이 유지**.

### E. 기타
- `be8df32` — 이벤트 페이지 상단 보기 모드 탭 4개 (기본/기간비교/페이지비교/설문통계) 제거

---

## ✅ 완성 기능 체크리스트

### 인프라
- [x] Workload Identity Federation (GCP ↔ Vercel OIDC)
- [x] GA4 Data API (heypick 속성 436683873)
- [x] Microsoft Clarity Data Export API (60분 캐시)
- [x] Vercel 자동 배포 (main 푸시)

### 성과 분석
- [x] 스코프 구조 (브랜드 > 프로젝트 > 랜딩페이지)
- [x] 3단 브레드크럼 드롭다운 셀렉터
- [x] URL 기반 스코프 전환 (`/analytics/{scope}/{id}`)
- [x] 집계 서비스 (event → project → brand)
- [x] 이벤트 1042 (더블어스) — 실 리드 437건 타임스탬프
- [x] 이벤트 3550 (굿리치) — Meta+TikTok 멀티채널
- [x] GA4 `/tasks/8426` · `/tasks/19524` 템플릿 경로 매칭
- [x] AI 진단 카드 (5 불릿) — 이벤트 페이지 최상단
- [x] 리포트 모드 (PPT · PDF · Excel) — 3개 포맷 다운로드

### ai MAX
- [x] Gemini 2.5 Flash + getEventFunnel 도구
- [x] tableData 도구 (format별 렌더링)
- [x] chartData 도구 (bar/line/pie)
- [x] 풀 퍼널 3 겹 프레임 시스템 프롬프트
- [x] 4 카테고리 예시 질문 (통합·광고·상담·예약)

### 디자인
- [x] boosterMAX 그린톤 (design-guide HSL 토큰)
- [x] Pretendard 폰트
- [x] 브랜드 그라디언트 유틸
- [x] 매체별 고유 색상 보존
- [x] 추이 차트 리드 막대 그린 (라이트 그린 #65CC91)

---

## 🗂 파일 구조 (2026-04-24 기준)

```
app/
  analytics/
    page.tsx                          ← /analytics → /brand/wepick 리다이렉트
    [scope]/[id]/page.tsx             ← 메인 스코프 분석 페이지 ⭐
  ai/page.tsx                         ← ai MAX 풀 퍼널 챗봇
  api/
    scope-analytics/route.ts          ← 스코프 집계 API ⭐ 신규
    event-analytics/route.ts          ← 이벤트 단일 API (공유 서비스 래퍼)
    ad-chat/route.ts                  ← ai MAX 스트림 + getEventFunnel/tableData/chartData
    ga4/page-debug/route.ts
    ga4/route.ts
    ad-performance/route.ts
  globals.css                         ← 디자인 토큰 (HSL 기반, design-guide) ⭐

next.config.ts                        ← 레거시 redirect `/analytics/:eventId(\d+)` → /event/
package.json                          ← xlsx-js-style 추가됨

src/
  lib/
    scope-catalog.ts                  ← 브랜드/프로젝트/이벤트 매핑 ⭐ 신규
    scope-analytics-service.ts        ← 스코프 집계 로직 ⭐ 신규
    event-analytics-service.ts        ← 이벤트 풀 퍼널 (route+AI 공유)
    mapping.ts                        ← #{eventId}_{code} 파싱
    ad-data.ts                        ← 광고 6채널 시뮬
    report-builder-pptx.ts            ← PPT 빌더 (pptxgenjs) ⭐
    report-builder-pdf.ts             ← PDF 빌더 (html2canvas+jsPDF) ⭐
    report-builder-xlsx.ts            ← Excel 빌더 (xlsx-js-style) ⭐
    channels/
      ga4.ts · clarity.ts · leads.ts
    real-data/
      event-1042.ts · event-1042-leads.ts
      event-3550.ts · event-3550-leads.ts

  components/
    analytics/
      BreadcrumbScopeSelector.tsx     ← 3단 드롭다운 ⭐ 신규
      AiDiagnosisCard.tsx             ← 이벤트 최상단 5 불릿 진단 ⭐
      ReportModeDialog.tsx            ← 리포트 모드 다이얼로그 ⭐
      FunnelFlow.tsx                  ← 5단계 퍼널 + 하단 4카드
      KpiGrid.tsx                     ← KPI + SourceBadge
      TrendChart.tsx                  ← 세션 선 + 리드·예약 막대 (그린톤)
      TrackingCodeTable.tsx
      ChannelFunnelCompareTable.tsx
      ChannelDonut.tsx                ← 채널 비중 + 광고비·CVR
      ChannelRadar.tsx
      SourceTable.tsx
      ClarityCard.tsx
      FunnelMetricsTable.tsx
      TrendGranularityToggle.tsx
    ui/
      AdAiQueryBox.tsx                ← ai MAX 채팅 UI
      AiTableBlock.tsx                ← tableData 렌더러 ⭐
      DateRangePicker.tsx
      ChannelIcon.tsx
    layout/
      Sidebar.tsx                     ← '성과 분석' 메뉴 + MobileTabBar
```

---

## 🔄 다음에 이어서 할 수 있는 작업

### 우선순위 높음
1. **비교 모드** (사용자 요청 · 나중에 진행) — 스코프 2개 나란히 비교
   - `BreadcrumbScopeSelector` 에 `+ 비교 추가` 버튼
   - `/analytics/compare?a=brand:wepick&b=project:doubleearth` URL
2. **리드·예약 실 DB 연동 (Phase 2)**
   - `src/lib/channels/leads.ts` 본문만 교체 (시그니처 유지)
   - 헤이픽/리드프로 리드 DB 접근 경로 미확정 — 담당자 확인 필요
3. **매체 실 광고비 연동**
   - 현재 모든 광고 데이터 시뮬레이션 or 하드코딩
   - 사내 IP `222.109.27.119` 수집 파이프라인 → DB → Vercel 조회 패턴 필요

### 우선순위 중
4. **대시보드 홈 (`/`) 과 성과 분석 연결**
   - 현재 `/` 는 광고 시뮬 기반 대시보드
   - 성과 분석으로 이어지는 CTA 카드 삽입 고려
5. **다른 이벤트 ID 확장** (11701, 9812 등)
   - `event-<id>.ts` + `scope-catalog.ts` 등록만 추가하면 자동 동작
6. **AI 진단 카드 개선**
   - 스코프 변경 시 (브랜드/프로젝트 수준) 에도 진단 생성
   - 현재는 이벤트 ID 기반 5 불릿이라 집계 스코프에서 재확인 필요

### 우선순위 낮음
7. **Clarity 다른 이벤트 확장** — 3550 도 Clarity 연동
8. **카탈로그 DB 연동** — `BRAND_CATALOG` 하드코딩 → 실 DB
9. **테스트 커버리지** — 집계 서비스 단위 테스트

---

## ⚠️ 알려진 이슈 / 제약

### Vercel Deployment Protection
Production 배포 URL 은 팀 멤버 인증 또는 bypass token 필요. 브라우저 로그인 상태로 접근하거나, 직접 curl 테스트 시 401 반환 (정상 동작).

### 매체 API IP 제약 (⚠️ 최우선)
Google Ads / Meta / Naver / Kakao / TikTok / 당근 API 는 **사내 IP `222.109.27.119` 에서만** 호출 가능. Vercel 서버리스 (동적 IP) 에서는 차단됨. 현재 모든 광고 데이터는 시뮬레이션 or 이벤트별 하드코딩.

### GCP 조직 정책 — SA 키 생성 불가
`iam.disableServiceAccountKeyCreation` 정책 적용. GCP 인증은 **반드시 WIF** (현재 설정됨) 또는 ADC 사용. SA JSON 키 방식 우회 금지.

### Clarity 데이터 기간
**최근 3일** 만 조회 가능. 일 10회 호출 한도. 3월 과거 데이터 재조회 불가 — 웹 콘솔 직접 확인.

### 로컬 dev GA4 미작동
WIF OIDC 가 Vercel 전용이라 로컬에선 `unavailable`. GA4 실데이터 확인은 Production URL 로.

---

## 🔑 외부 접근 정보

### GCP
- 조직: `youngeun-org`
- 프로젝트: `ga4-api-project` (Number: `384596964105`)
- 서비스 계정: `ga4-heypick-reader@project-150ad5c5-0e90-4383-9bc.iam.gserviceaccount.com`
- WIF Pool: `projects/384596964105/locations/global/workloadIdentityPools/vercel`
- OIDC Provider: `vercel` (Issuer: `https://oidc.vercel.com/wepick`)

### Vercel
- 팀: `wepick` (Hobby)
- 프로젝트: `booster-dashboard`
- Settings: https://vercel.com/wepick/booster-dashboard/settings
- OIDC Federation: Team mode (aud: `https://vercel.com/wepick`)

### GA4
- 헤이픽 속성: `436683873` (heypick.co.kr)
- 권한: `ga4-heypick-reader` SA (뷰어)

### Clarity
- 프로젝트: `p0v1letcwq` (heypick)
- 콘솔: https://clarity.microsoft.com/projects/view/p0v1letcwq/dashboard

### GitHub
- 레포: https://github.com/JeonYoungEun-WP/booster-dashboard
- 배포: Vercel 자동 (main 푸시)

---

## 📋 이어서 작업할 때 첫 명령

```bash
git clone https://github.com/JeonYoungEun-WP/booster-dashboard.git
cd booster-dashboard
npm install
cp .env.example .env.local    # 위 표 참조해서 값 채우기
npm run dev                   # http://localhost:3002
```

**첫 방문 URL**:
- 메인: http://localhost:3002/analytics (→ /analytics/brand/wepick 리다이렉트)
- ai MAX: http://localhost:3002/ai
- 랜딩페이지 단일: http://localhost:3002/analytics/event/1042

**실 GA4 확인**: Vercel Production URL 로 접근

---

## 📝 주요 문서
- **이 파일**: 세션 핸드오프 (진행 상황)
- [`CLAUDE.md`](../CLAUDE.md): Claude 작업 지침 (매체 IP 제약, AI 챗 규칙)
- [`docs/PRD.md`](PRD.md): 아키텍처 & 데이터 계층 (신규)
- [`docs/adriel-benchmark.md`](adriel-benchmark.md): 기능 벤치마크 (Adriel)
