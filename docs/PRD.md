# boosterMAX Dashboard — PRD / 아키텍처

**최종 업데이트**: 2026-04-24 (커밋 `3fff4db` 기준)

이 문서는 아키텍처 · 데이터 계층 · 주요 기능 · 확장 포인트를 요약합니다. 변경 이력은 [`session-handoff.md`](session-handoff.md) 참조.

---

## 1. 제품 요약

광고 투입부터 최종 예약까지 **풀 퍼널** 통합 분석 SaaS.

**핵심 가치**: "클릭 많은 광고 = 좋은 광고" 가 아니라 "광고비 1원당 결제 매출 회수" 를 기준으로 판단.

**사용자**: B2B 광고주 · 마케팅 에이전시 운영자. 위픽부스터 (booster.im) 내부 도구.

---

## 2. 데이터 계층

```
브랜드 (Brand)
 └── 프로젝트 (Project)
      └── 랜딩페이지 / 이벤트 (Event)
           └── 트래킹코드 / 광고세트 (TrackingCode)
                └── 캠페인 (Campaign)
```

### 2.1 현재 카탈로그 (하드코딩, `src/lib/scope-catalog.ts`)

```
브랜드: 위픽 코퍼레이션 (id: wepick)
├── 프로젝트: 더블어스 렌탈 (id: doubleearth)
│   └── 이벤트: 1042 (타이어 렌탈 · legacySlug: nexentire_rental)
│       기간: 2026-03-01 ~ 2026-03-31
│       채널: Meta
│       광고비 419.5만 / 리드 437 (실데이터) / 방문예약 41 / 결제 13
│
└── 프로젝트: 굿리치 보험 상담 (id: goodrich)
    └── 이벤트: 3550 ((주)굿리치 · 보험 상담 신청)
        기간: 2026-03-22 ~ 2026-04-21
        채널: Meta · TikTok
```

Phase 2 에서 DB 연동 시 이 카탈로그 본문만 교체 (시그니처 유지).

### 2.2 데이터 소스 (이벤트 수준)

| 단계 | 소스 | 비고 |
|---|---|---|
| 광고비·노출·클릭 | 이벤트별 하드코딩 (`real-data/event-<id>.ts`) | 매체 API 사내 IP 제약 → 시뮬/하드코딩 |
| 세션·페이지뷰 | GA4 Data API (`/tasks/{id}` 템플릿 경로 매칭) | WIF 기반 |
| 리드 | 하드코딩 실 타임스탬프 + 더미 혼합 | Phase 2: DB 연동 |
| 방문예약·결제 | 하드코딩 더미 | Phase 2: 리드 DB 상태 필드 연동 |
| Clarity (UX) | Clarity Data Export API | 최근 3일 / 일 10회 한도 |

### 2.3 캠페인 태그 조인 키

광고 캠페인명에 `#{eventId}_{trackingCode}` 가 박혀있어 유일한 조인 키로 사용.

예시: `39만원_1 #1042_f1219M1` → `{ eventId: "1042", trackingCode: "f1219M1" }`

파서: `src/lib/mapping.ts` · `parseCampaignTag()`

---

## 3. URL 라우트

| URL | 동작 | 파일 |
|---|---|---|
| `/` | 대시보드 홈 (광고 시뮬 기반) | `app/page.tsx` |
| `/analytics` | → `/analytics/brand/wepick` 리다이렉트 | `app/analytics/page.tsx` |
| `/analytics/{scope}/{id}` | 스코프 분석 메인 | `app/analytics/[scope]/[id]/page.tsx` |
| `/analytics/1042` (레거시) | → `/analytics/event/1042` 리다이렉트 (308) | `next.config.ts` |
| `/ai` | ai MAX 풀 퍼널 챗봇 | `app/ai/page.tsx` |
| `/creatives` | 소재별 성과 | `app/creatives/page.tsx` |
| `/integrations` | 매체 연결 상태 | `app/integrations/page.tsx` |
| `/automation` | 자동화 룰 (개발 중) | `app/automation/page.tsx` |
| `/report` | 레거시 Adriel 스타일 리포트 | `app/report/page.tsx` |
| `/settings` | 설정 | `app/settings/page.tsx` |

### 3.1 scope 값
- `brand` — 브랜드 내 모든 프로젝트·이벤트 집계
- `project` — 프로젝트 내 모든 이벤트 집계
- `event` — 단일 이벤트 (기존 동작)

### 3.2 중요: 동적 세그먼트 충돌 주의
Next.js 는 `app/analytics/[eventId]` 와 `app/analytics/[scope]` 같이 **같은 부모의 dynamic segment 공존 금지**. 레거시 URL 은 `next.config.ts` 의 `redirects()` 에서 처리해야 함.

---

## 4. API 라우트

| Endpoint | 용도 | 파라미터 |
|---|---|---|
| `GET /api/scope-analytics` | 스코프 집계 데이터 | `scope`, `id`, `startDate?`, `endDate?` |
| `GET /api/event-analytics` | 단일 이벤트 (레거시, AI 내부 공유) | `eventId`, `legacySlug?`, `startDate?`, `endDate?` |
| `POST /api/ad-chat` | ai MAX 스트림 | useChat 프로토콜 |
| `GET /api/ga4/page-debug` | GA4 pagePath 진단 | `startDate?`, `endDate?` |
| `GET /api/ga4` | GA4 summary (로컬 개발용) | — |
| `GET /api/ad-performance` | 광고 채널 요약 | — |
| `GET /api/channels/health` | 매체 연결 상태 | — |

### 4.1 내부 데이터 접근 원칙
**`/api/ad-chat` 내부에서는 HTTP fetch 금지.** 같은 데이터가 필요하면 `buildEventAnalytics()` 같은 **공유 서비스 함수 직호출**. Vercel Deployment Protection 이 내부 fetch 도 막아 bypass token 을 요구하게 되는 이슈.

공유 서비스:
- `src/lib/event-analytics-service.ts` (이벤트 단일)
- `src/lib/scope-analytics-service.ts` (스코프 집계)

---

## 5. 분석 화면 구성 (`/analytics/{scope}/{id}`)

```
┌──────────────────────────────────────────────┐
│ 성과 분석                                      │
│ [브랜드 ▼] › [프로젝트 ▼] › [랜딩페이지 ▼]  │  ← BreadcrumbScopeSelector
│ [날짜 범위]  [테스트 제외] [새로고침] [리포트]  │
├──────────────────────────────────────────────┤
│ 💎 AI 진단 카드 (5 불릿 + /ai 이동)            │  ← AiDiagnosisCard
├──────────────────────────────────────────────┤
│ FunnelFlow (노출→클릭→리드→예약→결제 5카드)    │
├──────────────────────────────────────────────┤
│ KpiGrid (페이지뷰 · 세션 · 평균 체류)          │
├──────────────────────────────────────────────┤
│ TrendChart (세션 선 + 리드·예약 막대 그린톤)   │
├──────────────────────────────────────────────┤
│ [ChannelDonut]  [ChannelFunnelCompareTable]   │
├──────────────────────────────────────────────┤
│ TrackingCodeTable (광고세트별 성과 + 합계)     │
├──────────────────────────────────────────────┤
│ [SourceTable]  [ClarityCard]                  │
└──────────────────────────────────────────────┘
```

### 5.1 용어 변형
이벤트 3550 (굿리치) 만:
- `방문예약` → `예약`
- `결제` → `계약`

브랜드/프로젝트 수준 집계에서는 기본 용어 (`방문예약`, `결제`) 사용.

---

## 6. ai MAX (풀 퍼널 AI)

### 6.1 모델 · 라우트
- 모델: Gemini 2.5 Flash
- 라우트: `app/api/ad-chat/route.ts`
- UI: `src/components/ui/AdAiQueryBox.tsx`

### 6.2 제공 도구

| 도구 | 용도 | 렌더링 |
|---|---|---|
| `getEventFunnel` | 풀 퍼널 데이터 (광고·상담·예약 3 겹) | — |
| `getTotalSummary` | 전체 채널 합계 | — |
| `getChannelSummary` | 채널별 비교 | — |
| `getDailyTrend` | 일자별 추이 | — |
| `getDailyByChannel` | 일자·채널별 비용 | — |
| `getCampaignPerformance` | 캠페인별 | — |
| `getCreativePerformance` | 소재별 | — |
| `getIntegrationStatus` | 매체 연결 상태 | — |
| `chartData` | 차트 렌더링 | bar/line/pie 최대 4 시리즈 |
| `tableData` | **구조화 표 렌더링** | format별 자동 포맷 (currency/percent/roas/code) |

### 6.3 시스템 프롬프트 규칙
1. 이벤트 ID (1042·3550) 또는 `/analytics/<id>` URL 감지 → `getEventFunnel` 우선
2. 표로 정리 가능한 데이터 (2×3 이상 비교) → **반드시 tableData 호출**
3. tableData 호출 후 본문은 인사이트·다음 액션만 (수치 재나열 금지)
4. 답변 템플릿: `[표] → 💡 인사이트 → 🎯 다음 액션`

### 6.4 이벤트 페이지 AI 진단 카드
`AiDiagnosisCard.tsx` — 규칙 기반 5 불릿 (핵심 성과 / 채널 효율 / Best 광고세트 / Worst 광고세트 / **개선 제안 액션 아이템**) + `/ai` 이동 링크.

---

## 7. 리포트 모드 (PPT · PDF · Excel)

**진입**: 이벤트 분석 페이지 우상단 "리포트 모드" 버튼 → 다이얼로그 → 포맷 선택.

| 포맷 | 빌더 | 특징 |
|---|---|---|
| PPT (.pptx) | `src/lib/report-builder-pptx.ts` (pptxgenjs) | 8 슬라이드 · 네이티브 편집 가능 · 도넛/콤보 차트 |
| PDF (.pdf) | `src/lib/report-builder-pdf.ts` (jsPDF + html2canvas) | 8 슬라이드 · 시각 고정도 · 한글 완벽 |
| Excel (.xlsx) | `src/lib/report-builder-xlsx.ts` (**xlsx-js-style**) | 6 시트 · 브랜드 디자인 · 자동 필터 |

### 7.1 Excel 스타일 (**중요: community xlsx 는 style write 미지원 → xlsx-js-style 사용**)
- 헤더: 브랜드 그린 `#3ABA85` 배경 + 화이트 텍스트
- Zebra stripe (짝수 행 `#F8F9FC`)
- 합계 행: 연한 그린 `#E8F6EF` bg + bold
- 숫자: Excel 네이티브 포맷 (₩#,##0 / #,##0 / 0.00%)
- ROAS: 1 이상 녹색, 미만 주황 자동 컬러
- 자동 필터 헤더 행 활성화

---

## 8. 디자인 시스템

**기준**: https://call-convo-master.vercel.app/design-guide

### 8.1 HSL 토큰 (`app/globals.css`)

| 토큰 | HSL | HEX | 용도 |
|---|---|---|---|
| `--primary` | 157 52% 48% | #3ABA85 | 버튼·링크·액센트 |
| `--primary-gradient-from` | 141 53% 63% | #65CC91 | 그라디언트 시작 (라이트 그린) |
| `--primary-gradient-to` | 214 93% 68% | #5FA8FA | 그라디언트 끝 (블루) |
| `--success` | 142 71% 45% | #22C55E | 성공 · 긍정 |
| `--warning` | 38 92% 50% | #F59E0B | 주의 · 부정 |
| `--destructive` | 0 72% 51% | #E23D3D | 파괴적 액션 |
| `--radius` | — | 0.5rem | 보더 반경 |

### 8.2 그라디언트 유틸
```css
.bg-brand-gradient   → linear-gradient(135deg, #65CC91, #5FA8FA)
.text-brand-gradient → 같은 그라디언트를 text clip
```

### 8.3 매체별 고유 색상 (**변경 금지**)
`src/lib/ad-data.ts` 의 `CHANNEL_COLOR_MAP`:

| 채널 | 색상 |
|---|---|
| Meta | #1877F2 |
| Google | #4285F4 |
| Naver | #03C75A |
| Kakao | #FEE500 |
| TikTok | #000000 |
| 당근 | #FF7E1D |

리포트 빌더의 `CHANNEL_COLORS` 맵에서도 동일. 브랜드 팔레트가 덮어쓰지 않도록 주의.

---

## 9. 핵심 제약 / ⚠️ 이 규칙은 어기면 안 됨

### 9.1 매체 API IP 화이트리스트 (최우선)
실 매체 API (Google/Meta/Naver/Kakao/TikTok/당근) 는 **사내 IP `222.109.27.119`** 에서만 호출 가능. Vercel 서버리스 (동적 IP) 에서는 직접 호출 **절대 금지**. 토큰 차단 위험.

패턴: 사내 IP 수집 배치 → DB 적재 → Vercel 웹앱은 DB 만 읽음.

### 9.2 GCP 조직 정책 — SA 키 금지
`iam.disableServiceAccountKeyCreation` 활성화. GCP 인증은 **반드시 WIF (현재)** 또는 ADC.

### 9.3 시크릿 파일 커밋 금지
- `.env.local` · `.env.*` · `.claude/settings*.json`
- 유출 시: 즉시 `rotate` (Clarity 토큰은 콘솔에서 revoke & regenerate, Gemini 는 https://aistudio.google.com/app/apikey).

### 9.4 내부 데이터 접근 — HTTP fetch 금지
AI 도구 · 서버 라우트 간 공유 데이터는 **함수 직호출** (공유 서비스 패턴). Vercel Deployment Protection 우회.

---

## 10. 확장 포인트

### 10.1 새 이벤트 추가
1. `src/lib/real-data/event-<id>.ts` · `event-<id>-leads.ts` 생성 (기존 1042/3550 참조)
2. `src/lib/scope-catalog.ts` 에 프로젝트·이벤트 등록
3. `src/lib/event-analytics-service.ts` 에 분기 추가 (현재는 1042·3550 만 override)
4. GA4 템플릿 경로 매핑 추가 (쿼리스트링 우회)

### 10.2 새 브랜드/프로젝트
`scope-catalog.ts` 의 `BRAND_CATALOG` 에 추가만 하면 자동으로:
- 브레드크럼 드롭다운에 노출
- 스코프 집계 자동 동작
- API 라우트 `GET /api/scope-analytics?scope=brand&id=<new>` 동작

### 10.3 비교 모드 (Phase 2 대기)
- `BreadcrumbScopeSelector` 에 `+ 비교 추가` 버튼
- `/analytics/compare?a=<scope>:<id>&b=<scope>:<id>` URL
- 분석 뷰를 2개 나란히 렌더

### 10.4 실 DB 연동 (Phase 2 대기)
- `src/lib/channels/leads.ts` 본문만 교체 (인터페이스 유지)
- `src/lib/scope-catalog.ts` → DB 쿼리 기반으로 교체

### 10.5 공통 `AnalyticsView` 컴포넌트 추출 (리팩토링)
현재 `app/analytics/[scope]/[id]/page.tsx` 에 500+ 줄 인라인. Phase 2 에서 `AnalyticsView.tsx` 로 추출 고려.

---

## 11. 주요 커밋 타임라인

최근 주요 이정표 (최신 → 과거):

| 커밋 | 날짜 | 내용 |
|---|---|---|
| `3fff4db` | 04-24 | 동적 세그먼트 충돌 수정 |
| `be62351` | 04-24 | 스코프 구조 (브랜드 > 프로젝트 > 이벤트) |
| `be8df32` | 04-24 | 이벤트 상단 보기 모드 탭 제거 |
| `0b80c4f` | 04-24 | ai MAX 리브랜딩 + 풀 퍼널 확장 |
| `8cc6a0c` | 04-24 | 리드 막대 그린톤 + Excel 디자인 + AI 표 우선 |
| `f264d39` | 04-24 | design-guide 그린톤 테마 |
| `038159a` | 04-24 | PPT·PDF·AI 진단 브랜드 팔레트 |
| `89002bc` | 04-24 | tableData 도구 + GFM 표 |
| `65e9723` | 04-24 | AI 진단 카드 (5 불릿) |
| `93b2f45` | 04-24 | PPT 콤보 차트 복구 + 4페이지 리디자인 |
| `7a15dcf` | 04-24 | Excel 다운로드 추가 |
| `ab565de` | 04-23 | 리포트 모드 (PPT/PDF) 최초 |
| `857ba33` | 04-23 | event-analytics 공유 서비스 추출 |
| `3da57aa` | 04-23 | AI 챗에 getEventFunnel 도구 |

전체 히스토리: `git log --oneline`
