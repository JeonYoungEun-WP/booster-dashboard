# booster-internal — Claude 작업 지침

## ⚠️ 최우선 규칙 — 매체 API 접근 제한

**IP `222.109.27.119` 환경에서만** 외부 매체 API(Meta / Google / Naver / TikTok / 당근마켓 등)를 호출할 수 있음.

### 이유
사내(허가된) IP에서만 매체사에 API 키가 화이트리스트되어 있음. 다른 IP에서 호출 시:
- 인증 실패 → 빈 데이터 반환
- 반복 호출 시 매체사로부터 토큰 차단·계정 제재 위험
- Vercel 서버리스 등 동적 IP 환경에서는 절대 직접 호출 금지

### 적용 원칙
1. **서버 라우트에서 매체 API를 직접 호출하기 전** 반드시 요청 IP를 검증 (`222.109.27.119`가 아니면 차단 또는 시뮬레이션 데이터로 폴백)
2. 배포된 Vercel 함수에서 **직접 매체사 API 호출 금지** — 사내 IP를 거치는 프록시(자체 수집 서버 / 크론 기반 배치) 패턴으로만 구성
3. 수집된 데이터는 DB(예: Supabase/Prisma)에 적재하고, 웹 앱은 DB에서만 읽음
4. 개발 중 로컬에서 테스트할 때도 사내 네트워크(또는 VPN) 연결 상태에서만 실제 API 호출

### 절대 커밋 금지 파일
- **`.env.local`, `.env`, `.env.*`** — API 키·DB·시크릿. `git add -f` 도 금지. 공유는 `.env.example` (키 이름만)으로.
- **`.claude/settings.json`, `.claude/settings.local.json`, `.claude/launch.json`** — Bash allow 리스트에 평문 토큰이 쌓일 수 있음.
- 히스토리에 한 번 올라간 시크릿은 `force push`로 지워도 GitHub 캐시·fork 에 잔존하므로, 유출 즉시 해당 키를 **rotate** 할 것.

### 체크리스트
- [ ] 새 매체 연동 코드를 추가할 때 IP 가드가 들어가 있는가
- [ ] API 응답 실패 시 조용히 시뮬레이션 데이터로 폴백하는가
- [ ] Vercel cron / route에서 매체 API를 직접 호출하는 코드가 있는지 주기적으로 점검

**이 규칙을 놓치면 토큰·계정이 일괄 차단되어 운영에 큰 피해가 발생하므로, 어떤 경우에도 잊지 말 것.**

---

## 프로젝트 개요

- Next.js 16 / React 19 / Vercel 배포 (booster-internal에서 분리된 독립 프로젝트)
- **boosterMAX** — 광고 · 상담 · 최종 예약 **풀 퍼널** 통합 분석 SaaS
- 주요 라우트:
  - `/` — 대시보드 홈 (광고 시뮬 기반)
  - `/analytics` → `/analytics/brand/wepick` 자동 리다이렉트
  - `/analytics/[scope]/[id]` — **스코프 분석 메인** (scope ∈ brand/project/event)
  - `/analytics/1042` (레거시) → `/analytics/event/1042` (next.config.ts redirect)
  - `/ai` — **ai MAX** 풀 퍼널 챗봇 (Gemini 2.5 Flash)
  - `/creatives` — 소재별 성과
  - `/integrations` — 매체 연결 상태
  - `/api/scope-analytics` — 스코프 집계 API (브랜드/프로젝트/이벤트)
  - `/api/event-analytics` — 단일 이벤트 API (AI 내부 공유)
  - `/api/ad-chat` — ai MAX 스트림 API
  - `/api/ga4/page-debug` — GA4 pagePath 진단
  - `/report` — (레거시) Adriel 스타일 4페이지 리포트

### ⚠️ 라우팅 주의
Next.js 는 같은 부모 폴더에 dynamic segment 2개 공존 금지. `app/analytics/[scope]/[id]` 아래에만 dynamic 라우트 두고, 레거시 URL 은 `next.config.ts` `redirects()` 에서 처리.

### 데이터 계층 (브랜드 > 프로젝트 > 이벤트)
- 카탈로그: `src/lib/scope-catalog.ts` (하드코딩)
- 집계 서비스: `src/lib/scope-analytics-service.ts`
- 브랜드 "위픽 코퍼레이션" → 프로젝트 "더블어스/굿리치" → 이벤트 "1042/3550"

## ai MAX (/ai) — 풀 퍼널 AI 분석

Gemini 2.5 Flash 기반. **광고 × 상담 × 최종 예약 3 겹 프레임**.

### 시스템 프롬프트 핵심 (`app/api/ad-chat/route.ts`)
- 이벤트 ID (예: 1042·3550) 또는 `/analytics/<id>` URL 감지 → `getEventFunnel` 우선
- 표로 정리 가능한 데이터 (2×3 이상) → **반드시 `tableData` 호출** (서술문 내 수치 나열 금지)
- 답변 템플릿: `[표] → 💡 인사이트 → 🎯 다음 액션`
- 핵심 프레임: "클릭 많은 광고 = 좋은 광고" ❌ → "광고비 1원당 결제 매출 회수" ⭕

### 제공 도구
| 도구 | 용도 |
|---|---|
| `getEventFunnel` | 이벤트 풀 퍼널 (광고→상담→예약→결제) |
| `getTotalSummary` | 전체 채널 합계 |
| `getChannelSummary` | 채널별 비교 |
| `getDailyTrend` · `getDailyByChannel` | 추이 |
| `getCampaignPerformance` · `getCreativePerformance` | 캠페인/소재 |
| `getIntegrationStatus` | 매체 연결 상태 |
| `chartData` | 차트 (bar/line/pie, 최대 4 시리즈) |
| **`tableData`** | **구조화 표 렌더링** (format: text/number/currency/percent/roas/code) |

### tableData format 규칙
- `currency` → ₩ 자동 (광고비·매출·CPA·CPC)
- `number` → 천단위 (노출·클릭·리드·예약·결제)
- `percent` (0.05 → 5.00%) → CTR·CVR
- `roas` → 자동 컬러 (1 이상 녹색 / 미만 주황) + 퍼센트
- `code` → 모노스페이스 (트래킹코드)
- `highlightRule: "top-roas"` / `"bottom-roas"` → 행 하이라이트
- `footer` → 합계/평균 행

### 데이터 접근 원칙 (중요)
- `/api/ad-chat` 내부에서 **HTTP fetch 금지**. 같은 데이터가 필요하면 공유 서비스 함수 직호출.
- Vercel Deployment Protection 이 내부 fetch 도 막아 bypass token 요구 → 함수 직호출로 우회.
- 공유 서비스:
  - `src/lib/event-analytics-service.ts` — 단일 이벤트
  - `src/lib/scope-analytics-service.ts` — 스코프 집계 (브랜드/프로젝트/이벤트)

### 필수 환경 변수
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini API 키 (https://aistudio.google.com/app/apikey)
- 등록 후 **재배포 필수** — Vercel 은 env 변경을 기존 빌드에 자동 반영 안 함.

### UI — `src/components/ui/AdAiQueryBox.tsx`
- `useChat` (ai-sdk/react) 기반 스트리밍 채팅
- `error` state 를 빨간 배너로 노출
- 인라인 차트 (`tool-chartData`) + **인라인 표 (`tool-tableData` · `AiTableBlock`)**
- 4 카테고리 예시 질문 (통합·광고·상담·예약) — 색상 코딩 태그

### 이벤트 페이지 AI 진단
`src/components/analytics/AiDiagnosisCard.tsx` — 규칙 기반 5 불릿 (핵심 성과 / 채널 효율 / Best 광고세트 / Worst 광고세트 / **개선 제안 액션**) + `/ai` 이동 링크.

## 리포트 모드 (PPT · PDF · Excel)

이벤트 분석 페이지 우상단 "리포트 모드" 버튼 → 다이얼로그 → 3가지 포맷.

| 빌더 | 파일 | 특징 |
|---|---|---|
| PPT | `src/lib/report-builder-pptx.ts` (pptxgenjs) | 8 슬라이드 네이티브 편집 |
| PDF | `src/lib/report-builder-pdf.ts` (jsPDF + html2canvas) | 시각 고정도 |
| Excel | `src/lib/report-builder-xlsx.ts` (**xlsx-js-style**) | 브랜드 디자인 + 자동 필터 |

**중요**: community `xlsx` 는 style write 미지원. Excel 스타일은 `xlsx-js-style` 사용.

## 디자인 시스템

**출처**: https://call-convo-master.vercel.app/design-guide

`app/globals.css` 에 HSL 토큰 정의:
- `--primary: 157 52% 48%` (#3ABA85 브랜드 그린)
- `--primary-gradient-from/to` 135deg 그린 → 블루 그라디언트
- `--success: 142 71% 45%` (#22C55E)
- `.bg-brand-gradient` · `.text-brand-gradient` 유틸

**⚠️ 매체 고유 색상 (변경 금지)**: Meta #1877F2 · Google #4285F4 · Naver #03C75A · Kakao #FEE500 · TikTok #000000 · 당근 #FF7E1D — `src/lib/ad-data.ts` `CHANNEL_COLOR_MAP` 에 정의.

## 벤치마크 레퍼런스
- **Adriel** (adriel.com) — [`docs/adriel-benchmark.md`](docs/adriel-benchmark.md)
- **Call Convo Master** (call-convo-master.vercel.app/design-guide) — design-guide 팔레트 원천

## 작업 기본 방향
- 기존 파일 수정 우선. 새 파일·문서 생성 최소화
- 광고 매체 데이터는 `src/lib/ad-data.ts` 통해서만 접근
- 실 매체 API 호출 분기 앞에는 반드시 `canFetchRealMediaData()` 가드
- AI 내부 데이터 공유는 **HTTP fetch 금지**, 공유 서비스 함수 직호출
- 브랜드 컬러 변경 시 매체별 색상은 절대 덮어쓰지 말 것
- Excel 스타일 작업은 **xlsx-js-style** (community `xlsx` 가 아님)

## 주요 문서
- [`docs/PRD.md`](docs/PRD.md) — 아키텍처 · 데이터 계층 · 기능 요약 (신규)
- [`docs/session-handoff.md`](docs/session-handoff.md) — 진행 상황 · 셋업 가이드
- [`docs/adriel-benchmark.md`](docs/adriel-benchmark.md) — 기능 벤치마크
