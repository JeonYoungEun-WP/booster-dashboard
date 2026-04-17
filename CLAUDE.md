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
- 광고 통합 성과 분석 전용 대시보드 (Google · Meta · Naver · Kakao · TikTok · 당근)
- 주요 라우트:
  - `/` — 대시보드 (KPI · 채널 비교 · 일자 추이 · 상위 캠페인)
  - `/report` — Adriel 스타일 4페이지 리포트 (표지 · 지표 · 추이 · 소재)
  - `/creatives` — 소재별 성과 분석
  - `/ai` — AI 분석 챗봇 (Gemini 2.5 Flash)
  - `/integrations` — 매체 연결 상태
  - `/api/ad-performance` — 대시보드 데이터 API
  - `/api/ad-chat` — AI 분석 스트림 API

## 벤치마크 레퍼런스
기능·UX 방향의 기준은 **Adriel**(adriel.com) — 전체 스펙을 [`docs/adriel-benchmark.md`](docs/adriel-benchmark.md) 에 정리. 위젯 시스템·리포트 모드·자동화 룰·AI 에이전트·100+ 채널 연동이 핵심 참조점.

## 작업 기본 방향
- 기존 파일 수정 우선. 새 파일·문서 생성 최소화
- 광고 매체 데이터는 `src/lib/ad-data.ts` 통해서만 접근
- 실 매체 API 호출 분기 앞에는 반드시 `canFetchRealMediaData()` 가드
- UI/UX 패턴은 Adriel 벤치마크 문서 우선 참조 (좌측 아이콘 사이드바, 위젯 기반 대시보드, 대시보드↔리포트 모드 전환 등)
