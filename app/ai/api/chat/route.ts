/**
 * 챗봇 API 라우트 — Phase 3에서는 기존 /api/ad-chat 의 핸들러를 그대로 재사용.
 * Phase 4 에서 본문을 이 파일로 이전하고 Claude Sonnet 4.5 로 교체 + DB 저장 추가.
 *
 * useChat 가 보내는 body 형식과 호환 (extra 필드 id·sessionId는 무시되어도 무방).
 */

export { POST, maxDuration } from '@/app/api/ad-chat/route'
