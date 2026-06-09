# 다음 세션 작업 계획 — vercel/chatbot 마이그레이션 Phase 4·5

> 작성: 2026-06-09 · 직전 세션에서 Phase 0~3 완료 후 일시중단.
> 이 문서만 보고 다른 PC 에서 작업을 이어받을 수 있도록 작성.

---

## ✅ 직전 세션 완료 사항

### 브랜치
- 작업 브랜치: **`migration/vercel-chatbot`** (origin 에 push 됨)
- 베이스: `main`
- PR 링크: https://github.com/JeonYoungEun-WP/booster-dashboard/pull/new/migration/vercel-chatbot

### 커밋 6개

| 커밋 | Phase | 내용 |
|---|---|---|
| `4baf7f6` | 0 | 마이그레이션 계획 문서 [`docs/migration-vercel-chatbot.md`](migration-vercel-chatbot.md) |
| `4ab5606` | 1 | 의존성 추가 — Anthropic·Drizzle·Postgres·shadcn 기반 |
| `adee943` | 2 | DB 스키마·queries·config (실 마이그레이션은 시크릿 받은 후) |
| `7600b16` | 3a | shadcn UI(26) + ai-elements(7) + hooks(3) 이식 |
| `8a6d0c0` | 3b | chat 컴포넌트 4개만 도입 (의존성 깊은 것 제외) |
| `9a8f198` | 3 | 자체 `Chat.tsx` + `SuggestedQuestions.tsx` + `/ai` 페이지 교체 |

타입체크 ✓, 광고 분석 페이지 영향 없음.

---

## 🚀 다음 세션 — 빠른 시작

### 1. 환경 셋업

```bash
git fetch origin
git checkout migration/vercel-chatbot
git pull
npm install
```

`.env.local` 에 추가할 시크릿 3개:

```env
# Phase 4 에서 사용
ANTHROPIC_API_KEY=sk-ant-...

# Phase 2 마이그레이션 + Phase 4 메시지 저장에 사용
# booster-internal 의 Supabase 인스턴스에서 가져옴
# Supabase Dashboard → Settings → Database → Connection string
POSTGRES_URL=postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres
POSTGRES_URL_NON_POOLING=postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:5432/postgres
```

> 자세한 시크릿 출처는 [docs/session-handoff.md](session-handoff.md) 의 기존 항목 그대로 + 위 3개 추가.

### 2. 시크릿 받은 직후 실행 명령

```bash
# Supabase 의 chatbot schema 에 chat·message_v2 테이블 생성
npm run db:push

# 정상이면 prompt 가 "✓ Changes applied" 출력
# 검증: npm run db:studio 로 GUI 에서 확인
```

> `db:push` 가 schema 'chatbot' 을 자동 생성하지 못하면, Supabase SQL Editor 에서 `CREATE SCHEMA IF NOT EXISTS chatbot;` 한 줄 먼저 실행 후 재시도.

---

## 📋 Phase 4 — 광고 도구 이식 + Claude 전환 (30~40분)

### 작업 단위

#### 4.1 — Claude 전환 (10분)

기존 `/api/ad-chat/route.ts` 핸들러를 `/ai/api/chat/route.ts` 본문으로 이전하고 모델 교체.

**파일 변경**:
- 신규: `app/ai/api/chat/route.ts` (본문 작성 — 현재는 `/api/ad-chat` 재export)
- 그대로: `app/api/ad-chat/route.ts` (Phase 5 머지 후 폐기 결정)

**모델 교체 핵심 diff**:
```diff
- import { google } from '@ai-sdk/google'
+ import { anthropic } from '@ai-sdk/anthropic'

- model: google('gemini-2.5-flash'),
+ model: anthropic('claude-sonnet-4-5'),
```

**검증**:
```bash
npm run dev
# → http://localhost:3002/ai
# 예시 질문 클릭 → 도구 호출 흐름·차트·표 모두 동일하게 나오는지
```

#### 4.2 — 메시지 DB 저장·복원 (15분)

`useChat` 의 `onFinish` 콜백 + 라우트 핸들러에서 메시지를 `chat` / `message_v2` 테이블에 저장.

**필요한 작업**:

1. `app/ai/api/chat/route.ts` 의 POST 핸들러 시작부에서:
   ```ts
   const { id, sessionId, messages } = await req.json()
   // 사용자 메시지 저장 (마지막 메시지가 새 사용자 입력)
   const userMsg = messages[messages.length - 1]
   await saveMessages({ messages: [{ id: userMsg.id, chatId: id, role: userMsg.role, parts: userMsg.parts, attachments: [] }] })
   // 새 채팅이면 chat row 생성 (title 은 자동 생성)
   const existing = await getChatById({ id })
   if (!existing) {
     await createChat({ id, sessionId, title: extractTitle(userMsg) })
   }
   ```
2. `result.toUIMessageStream` 의 `onFinish` 에서 어시스턴트 응답 저장:
   ```ts
   return result.toUIMessageStreamResponse({
     onFinish: async ({ responseMessage }) => {
       await saveMessages({
         messages: [{ id: responseMessage.id, chatId: id, role: 'assistant', parts: responseMessage.parts, attachments: [] }],
       })
       await touchChat(id)
     },
   })
   ```
3. 새 라우트 `app/ai/api/history/route.ts` (GET) — 현재 세션의 대화 목록 반환
4. 새 라우트 `app/ai/api/chat/[id]/route.ts` (GET) — 특정 대화의 메시지 복원
5. `Chat.tsx` 에서 `initialMessages` prop 받아 useChat 에 전달

**파일 신규**:
- `app/ai/api/history/route.ts`
- `app/ai/api/chat/[id]/route.ts`
- `app/ai/chat/[id]/page.tsx` (과거 대화 열기)

**파일 수정**:
- `app/ai/api/chat/route.ts` — 본문 작성
- `src/components/chat/Chat.tsx` — initialMessages prop 활성화

#### 4.3 — 사이드바 히스토리 (선택, 10~15분)

자체 작성한 `src/components/chat/ChatSidebar.tsx`:
- `/ai/api/history` 호출해 현재 세션 대화 목록
- 클릭 시 `/ai/chat/[id]` 로 이동
- "새 대화" 버튼 → `/ai` 로 이동 (새 chatId)

**파일 신규**:
- `src/components/chat/ChatSidebar.tsx`

**파일 수정**:
- `app/ai/page.tsx` + `app/ai/chat/[id]/page.tsx` 가 사이드바 같이 렌더

> 사이드바 없이도 챗봇은 동작. 우선순위 낮음 — Phase 5 머지 후로 미뤄도 됨.

---

## 📋 Phase 5 — 검증 · 머지 · 배포 (10~15분)

### 5.1 — 로컬 검증 체크리스트

```bash
npm run dev
```

- [ ] `/analytics/event/3550` 정상 (광고분석 페이지 영향 없음)
- [ ] `/ai` 새 챗봇 UI 진입 OK
- [ ] 예시 질문 8개 중 3개 이상 답변·차트·표 정상
- [ ] 새로고침 후 대화 복원 (4.2 도입 시)
- [ ] 광고 도구 8개 호출 흐름 (Tool 컴포넌트 펼침에서 input·output 확인)
- [ ] 콘솔 에러 없음

```bash
npx tsc --noEmit       # 0 errors
npm run lint           # 0 errors (warning 허용)
npx next build         # ✓ Compiled successfully
```

### 5.2 — main 머지

```bash
# 깨끗하게 squash 또는 머지 커밋
git checkout main
git merge migration/vercel-chatbot
# 또는 GitHub PR 에서 머지 (recommended)
git push origin main
```

### 5.3 — Vercel 환경변수

https://vercel.com/wepick/booster-dashboard/settings/environment-variables

- [ ] `ANTHROPIC_API_KEY` 추가 (Production + Preview)
- [ ] `POSTGRES_URL` 추가
- [ ] `POSTGRES_URL_NON_POOLING` 추가

→ 변수 추가 후 Deployments 탭에서 마지막 배포 **Redeploy** 한 번.

### 5.4 — Production 검증

배포 완료 후 (~2분):

- [ ] https://booster-dashboard-three.vercel.app/analytics/event/3550 정상
- [ ] https://booster-dashboard-three.vercel.app/ai 새 챗봇 동작
- [ ] 도구 호출·차트·표 production 에서 확인
- [ ] 대화 저장됨 (Supabase SQL Editor 에서 `select * from chatbot.chat;` 확인)

---

## 🔥 트러블슈팅

### Drizzle push 가 schema 'chatbot' 없다고 에러

```sql
-- Supabase SQL Editor 에서 1회 실행
CREATE SCHEMA IF NOT EXISTS chatbot;
GRANT ALL ON SCHEMA chatbot TO postgres;
GRANT ALL ON SCHEMA chatbot TO authenticated;
GRANT ALL ON SCHEMA chatbot TO anon;
```

### Claude API rate limit / 비용 폭증

- `.env.local` 의 `ANTHROPIC_API_KEY` 일시 제거 → `/api/ad-chat` 재export 가 Gemini 로 fallback 안 되도록 라우트 수정 필요
- 또는 4.1 단계로 롤백: `model: google('gemini-2.5-flash')` 로 되돌림

### 광고 도구가 호출 안 됨

- 도구 description 한국어를 Claude 가 더 잘 이해함 — 그대로 사용
- `stopWhen: stepCountIs(6)` 가 너무 작으면 8 로 늘려보기
- Claude 의 tool_choice 강제: `toolChoice: 'auto'` (기본) 또는 특정 도구 강제

### useChat 가 메시지 못 받음

- `DefaultChatTransport` 의 `prepareSendMessagesRequest` 가 body 형식을 바꿔서 보냄
- 라우트에서 `const { id, sessionId, messages } = await req.json()` 으로 받는지 확인
- ad-chat 재export 인 동안엔 `id`·`sessionId` 무시되어도 동작 (extra 필드)

---

## 🔙 롤백 (혹시 잘못되면)

브랜치 자체가 `migration/vercel-chatbot` 이라 main 은 안전. 머지 후 문제 발생 시:

```bash
# 머지 커밋만 revert
git checkout main
git revert -m 1 <merge-commit-sha>
git push origin main
```

DB 테이블은 그대로 두어도 다른 운영 데이터와 schema 격리되어 있어 무해.

---

## 📂 파일 인덱스 (이미 만들어진 것)

### Phase 1 — 의존성
- `package.json` — 신규 의존성 14개 추가

### Phase 2 — DB
- `drizzle.config.ts`
- `src/lib/db/schema.ts` — chat, message_v2
- `src/lib/db/index.ts` — postgres-js 클라이언트
- `src/lib/db/queries.ts` — createChat, getChatById, getChatsBySessionId, saveMessages, getMessagesByChatId, deleteChat, touchChat 등

### Phase 3 — UI
- `src/components/ui/*` — shadcn 26개
- `src/components/ai-elements/*` — 7개 (conversation, message, prompt-input, tool, code-block, model-selector, suggestion)
- `src/components/chat/*` — icons, greeting, submit-button, data-stream-provider (vercel/chatbot 발췌)
- `src/components/chat/Chat.tsx` — **메인 (자체 작성)**
- `src/components/chat/SuggestedQuestions.tsx` — **광고 도메인 예시 질문 (자체 작성)**
- `src/hooks/*` — use-messages, use-scroll-to-bottom, use-mobile
- `src/lib/types.ts` — ChatMessage, MessageMetadata
- `src/lib/utils.ts` — cn 헬퍼
- `src/lib/session-id.ts` — 익명 sessionId 헬퍼

### 라우트
- `app/ai/page.tsx` — 새 `Chat` 사용
- `app/ai/api/chat/route.ts` — 현재 `/api/ad-chat` 재export (Phase 4 에서 본문 이전)

### 보존 (광고분석 영역 — 절대 건드리지 말 것)
- `app/analytics/**`
- `app/api/event-analytics/**`
- `src/lib/ad-data.ts`
- `src/lib/event-analytics-service.ts`
- `src/lib/real-data/*`
- `src/components/analytics/*`

---

## 🎯 작업 시 우선순위 추천

1. **시크릿 셋업** — 5분
2. **`npm run db:push`** — schema 생성 검증
3. **Phase 4.1 Claude 전환** — 10분 (가장 큰 가치)
4. **로컬 검증** — Phase 4.1 만으로도 production 쓸만함
5. **Phase 4.2 DB 저장** — 15분 (대화 영속화)
6. **Phase 5 머지·배포** — 10분
7. **(이후) Phase 4.3 사이드바** — 추가 PR

Phase 4.1 만 끝내고 머지해도 사용자 가치는 크게 올라감 (Claude 답변 품질). 4.2 는 그 다음 작은 PR 로 나눠도 OK.

---

## ❓ 다음 세션 시작 시 확인할 것

- [ ] booster-dashboard 레포 `migration/vercel-chatbot` 브랜치인지
- [ ] `npm install` 완료 후 `npm run dev` 가 에러 없이 뜨는지
- [ ] `.env.local` 에 3개 시크릿 + 기존 Gemini·GA4·Clarity 키 모두 있는지
- [ ] [docs/migration-vercel-chatbot.md](migration-vercel-chatbot.md) 마이그레이션 계획서 1회 통독
