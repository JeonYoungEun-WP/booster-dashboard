# booster-dashboard

**boosterMAX** — 광고 · 상담 · 최종 예약을 잇는 **풀 퍼널 성과 분석** 대시보드.
Next.js 16 · React 19 · Vercel.

## 시작하기

```bash
npm install
cp .env.example .env.local   # 키 채우기 (docs/session-handoff.md 참고)
npm run dev                  # http://localhost:3002
```

| 스크립트 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (포트 3002) |
| `npm run build` | 프로덕션 빌드 |
| `npm test` | vitest 단위 테스트 |
| `npm run lint` | ESLint |

## 주요 화면

- `/analytics` — 성과 분석 (브랜드 › 프로젝트 › 랜딩페이지 스코프)
- `/ai` — ai MAX 풀 퍼널 AI 챗봇
- `/creatives` — 소재별 성과
- 이벤트 분석 페이지 우상단 **리포트 모드** → PPT · PDF · Excel 다운로드

## 문서

- [CLAUDE.md](CLAUDE.md) — 작업 지침 (최우선 규칙 · 공용 유틸 · 데이터 모델)
- [docs/PRD.md](docs/PRD.md) — 아키텍처 · 기능 요약
- [docs/session-handoff.md](docs/session-handoff.md) — 셋업 · 환경변수 · 진행 상황
- [docs/migration-vercel-chatbot.md](docs/migration-vercel-chatbot.md) — 챗봇 마이그레이션 계획 (브랜치 `migration/vercel-chatbot`)

## ⚠️ 최우선 규칙

외부 매체 API(Meta/Google/Naver/TikTok/Kakao/당근)는 **사내 허가 IP에서만** 호출.
`.env*` · `.claude/settings*.json` 은 **절대 커밋 금지**. 자세한 내용은 [CLAUDE.md](CLAUDE.md).
