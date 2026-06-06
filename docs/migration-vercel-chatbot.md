# vercel/chatbot 마이그레이션 계획

> 현재 `/ai` 챗봇(Vercel AI SDK 위의 자체 구현)을 [vercel/chatbot](https://github.com/vercel/chatbot) 정식 템플릿 구조로 이전한다.
> 시작: 2026-06-06, 브랜치: `migration/vercel-chatbot`.

---

## 1. 의사 결정 사항

| 항목 | 결정 |
|---|---|
| 레포 전략 | **booster-dashboard 새 브랜치** `migration/vercel-chatbot` → 검증 후 main 머지 |
| 채팅 히스토리 DB | **Supabase Postgres** (booster-internal과 동일 인스턴스 또는 별도 schema) |
| 사용자 인증 | **당분간 없음** (NextAuth 제거, 익명 sessionId) |
| LLM 모델 | **Anthropic Claude Sonnet 4.5** (Gemini → Claude 전환) |

---

## 2. 현재 vs 목표 디렉토리 매핑

### 2.1 vercel/chatbot 의 표준 구조

```
app/
  (auth)/                    ← NextAuth 라우트 (우리는 제거)
  (chat)/
    api/chat/route.ts        ← streamText + tools 핵심
    chat/[id]/page.tsx       ← 채팅 페이지
    layout.tsx
  layout.tsx
  globals.css
components/
  chat/                      ← 채팅 UI 컴포넌트군
    chat.tsx, messages.tsx, message-actions.tsx, multimodal-input.tsx, suggested-actions.tsx, app-sidebar.tsx, ...
  ai-elements/               ← AI SDK Elements (tool 호출 렌더)
  ui/                        ← shadcn/ui (button, dialog, dropdown, ...)
hooks/
lib/
  ai/                        ← 모델·툴 설정
  db/                        ← Drizzle schema + queries
  artifacts/                 ← 코드 캔버스 (선택 보존)
  utils.ts, errors.ts, ratelimit.ts
drizzle.config.ts
instrumentation.ts
```

### 2.2 booster-dashboard 의 현재 구조

```
app/
  ai/page.tsx                ← AdAiQueryBox 한 줄짜리 페이지
  api/ad-chat/route.ts       ← 광고 도구 8개 + streamText
  analytics/[scope]/[id]/    ← 풀퍼널 대시보드 (유지)
  api/event-analytics/       ← 광고분석 데이터 API (유지)
  ... (creatives, automation, integrations, report 등)
src/
  components/analytics/      ← 대시보드 컴포넌트 (유지)
  components/ui/AdAiQueryBox.tsx  ← 현재 챗봇 UI (교체 대상)
  lib/ad-data.ts             ← 광고 도구 백엔드 (유지)
  lib/event-analytics-service.ts
  lib/real-data/             ← 실 이벤트 데이터 (유지)
```

### 2.3 마이그레이션 후 통합 구조

```
app/
  ai/                              ← 챗봇 전용 (라우트 그룹 없이)
    page.tsx                       ← 채팅 메인 (대화 ID 자동 생성)
    chat/[id]/page.tsx             ← 과거 대화 열기
    api/chat/route.ts              ← (구) ad-chat/route.ts 이식
    api/history/route.ts           ← 대화 목록
    api/chat/[id]/route.ts         ← 대화 삭제·이름변경
  analytics/...                    ← 그대로
  api/event-analytics/             ← 그대로
src/
  components/chat/                 ← vercel/chatbot 의 components/chat/ 이식
  components/ai-elements/          ← vercel/chatbot 의 ai-elements/ 이식
  components/ui/                   ← 기존 + shadcn (button/dialog 신규 도입)
  components/analytics/            ← 그대로
  lib/db/                          ← NEW Drizzle schema·queries (Supabase 연결)
  lib/ai/                          ← NEW 모델·툴 설정 (Claude)
  lib/ad-data.ts                   ← 그대로 (도구의 백엔드)
drizzle.config.ts                  ← NEW
```

**원칙**:
- `app/analytics/` · `app/api/event-analytics/` · `src/lib/ad-data.ts` · `src/lib/real-data/` · `src/components/analytics/` 등 **광고분석 코어는 절대 건드리지 않는다**
- `app/api/ad-chat/route.ts` 의 tools 8개 정의는 **그대로 새 위치로 이식** (코드 복붙 가능)
- 광고 도구의 백엔드 함수(`getEventFunnel`, `buildEventAnalytics`, `getChannelSummary` 등) 도 그대로 사용
- 챗봇 페이지만 새 UI/DB 구조로 교체

---

## 3. Phase별 작업 계획

### Phase 0 — 계획 + 브랜치 (현재)
- [x] `migration/vercel-chatbot` 브랜치 생성
- [x] 이 문서 작성

### Phase 1 — 의존성 추가
- `package.json` 에 추가:
  ```
  drizzle-orm ^0.34.0
  drizzle-kit ^0.25.0 (devDeps)
  postgres ^3.4.4
  @ai-sdk/anthropic ^3.0
  swr ^2.2
  usehooks-ts ^3.1
  @radix-ui/react-dropdown-menu, @radix-ui/react-dialog, @radix-ui/react-tooltip (shadcn 의존)
  class-variance-authority, clsx, tailwind-merge (shadcn 의존)
  ```
- 제거하지 않음 (혹시 모를 호환): `@ai-sdk/google`
- `npm install` → 타입체크 통과

### Phase 2 — Supabase Postgres + Drizzle 스키마
- `drizzle.config.ts` 생성 (`POSTGRES_URL` 환경변수 기반)
- `src/lib/db/schema.ts` — vercel/chatbot 스키마 차용, 단순화:
  - `chat` (id, createdAt, title, sessionId, visibility)
  - `message_v2` (id, chatId, role, parts JSONB, createdAt)
  - **`user` 테이블 제외** (인증 없음 → sessionId 만 사용)
- `src/lib/db/queries.ts` — getChatById, saveChat, getMessagesByChatId, saveMessages 등
- `src/lib/db/index.ts` — postgres 클라이언트 + drizzle 인스턴스
- `.env.example` 에 `POSTGRES_URL` 추가
- 첫 마이그레이션: `npx drizzle-kit generate` + `push`

### Phase 3 — UI 이식
- vercel/chatbot 의 `components/chat/`·`components/ai-elements/`·`components/ui/` 을 `src/components/` 아래로 이식
- NextAuth 의존부 제거:
  - `useSession()`·`auth()` 호출 → 익명 sessionId 헬퍼로 교체
  - `app-sidebar.tsx` 의 사용자 영역 → 단순 "BoosterMAX AI" 로고로
- `app/ai/page.tsx` 가 새 `Chat` 컴포넌트 사용하도록 교체
- 한국어 라벨 적용 (suggested-actions 등)
- 기존 광고 예시 8개 그대로 (`이벤트 1042 풀퍼널 진단해줘` 등)

### Phase 4 — 광고 도구 8개 이식 + Claude 전환
- `app/api/ad-chat/route.ts` 의 tools → `app/ai/api/chat/route.ts` 로 이전
- 모델 교체:
  ```ts
  // before
  import { google } from '@ai-sdk/google'
  model: google('gemini-2.0-flash-exp')
  // after
  import { anthropic } from '@ai-sdk/anthropic'
  model: anthropic('claude-sonnet-4-5')
  ```
- `chartData`·`tableData` tool 결과 → ai-elements 의 ToolUIPart 로 렌더링
- 환경변수: `ANTHROPIC_API_KEY` 추가 (Vercel + .env.example)
- Tool 호출 후 결과를 메시지 parts 로 DB 저장 → 새로고침해도 차트 유지

### Phase 5 — 검증 · 머지 · 배포
- `npx tsc --noEmit` 통과
- `npx next build` 통과
- 로컬 dev 검증:
  - `/analytics/event/3550` 정상 (영향 없음)
  - `/ai` 새 챗봇 동작 (예시 질문 8개)
  - 대화 히스토리 저장·재방문 시 복원
  - 차트·표 렌더링 확인
- Vercel 환경변수 등록: `ANTHROPIC_API_KEY` + `POSTGRES_URL`
- `migration/vercel-chatbot` → `main` PR 머지
- production 배포 후 health check

---

## 4. 광고 도구 8개 이식 매핑

현재 `app/api/ad-chat/route.ts` 의 8개 tools — 새 위치에서 동일하게 사용:

| 도구 | 백엔드 호출 (그대로 유지) |
|---|---|
| `getEventFunnel` | `buildEventAnalytics(eventId, startDate, endDate)` |
| `getTotalSummary` | `getTotalSummary({ startDate, endDate })` |
| `getChannelSummary` | `getChannelSummary({ startDate, endDate })` |
| `getDailyTrend` | `getDailyTrend({ startDate, endDate })` |
| `getDailyByChannel` | `getDailyByChannel({ startDate, endDate })` |
| `getCampaignPerformance` | `getCampaignPerformance({ startDate, endDate })` |
| `getCreativePerformance` | `getCreativePerformance({ startDate, endDate })` |
| `getIntegrationStatus` | `getIntegrationStatus()` |
| `chartData` (렌더링) | 반환값을 ai-elements ToolUIPart 로 차트 렌더 |
| `tableData` (렌더링) | 반환값을 ai-elements ToolUIPart 로 표 렌더 |

→ **백엔드 함수 변경 없음**. tool 정의 위치만 새 route.ts 로 옮기고, model 만 교체.

---

## 5. 환경변수

`.env.example` 갱신:

```
# AI
ANTHROPIC_API_KEY=                  # NEW (Claude Sonnet 4.5)
GOOGLE_GENERATIVE_AI_API_KEY=       # 보존 (호환·롤백용)

# DB (Supabase Postgres)
POSTGRES_URL=                       # NEW (postgres://postgres:[password]@db.[ref].supabase.co:5432/postgres)
POSTGRES_URL_NON_POOLING=           # NEW (서버리스용 — drizzle-kit 마이그레이션용)

# 기존 광고 데이터 관련 키는 보존
GA4_PROPERTY_ID=
GCP_SA_KEY_JSON=
...
```

---

## 6. NextAuth 우회 전략

vercel/chatbot 은 곳곳에서 `auth()` 를 호출해 `userId` 를 사용. 우리는 인증 없음:

| vercel/chatbot 호출 | 대체 |
|---|---|
| `const session = await auth()` | `getOrCreateSessionId()` 헬퍼 (쿠키 기반 익명 ID) |
| `session.user.id` | sessionId (UUID) |
| `<SignIn />` UI | 제거 |
| `app/(auth)/` 그룹 | 통째로 미이식 |
| `chat.userId` 컬럼 | `chat.sessionId` 로 rename |

→ 추후 인증 도입 시 `sessionId → userId` 마이그레이션 1회.

---

## 7. 위험 요소 + 롤백

| 위험 | 완화 |
|---|---|
| 기존 `/analytics` 페이지 영향 | `app/analytics/` 디렉토리 미수정 정책 + Phase 5 회귀 테스트 |
| Claude API 비용 급증 | 환경변수 가드 + 일일 한도 모니터링 + rate limit |
| DB 마이그레이션 실패 | Supabase 별도 schema (e.g. `chatbot`) 로 격리 |
| 빌드 깨짐 | 브랜치 작업, main 보호 |
| 롤백 필요 시 | `git revert <merge-sha>` → 기존 `/ai` 챗봇 복귀, DB는 보존 |

---

## 8. 작업 추적

Claude Code Task 6개로 분할 등록 — 각 Phase 가 곧 하나의 PR 단위.
진행 상황은 `TaskList` 로 확인.
