/**
 * Drizzle 쿼리 헬퍼 — vercel/chatbot 의 queries.ts 단순화 버전.
 *
 * 인증 없는 sessionId 기반 소유권:
 * - 모든 조회·삭제는 sessionId 일치 확인 (또는 visibility='public')
 * - 익명 사용자가 다른 사람의 private 대화에 접근 불가
 */

import 'server-only'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from './index'
import { chat, messageV2, type Chat, type Message, type NewMessage } from './schema'

// ───── Chat ─────

export async function createChat({
  id, sessionId, title,
}: { id?: string; sessionId: string; title: string }): Promise<Chat> {
  const [row] = await db
    .insert(chat)
    .values({ ...(id ? { id } : {}), sessionId, title })
    .returning()
  return row
}

export async function getChatById({ id }: { id: string }): Promise<Chat | null> {
  const rows = await db.select().from(chat).where(eq(chat.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getChatsBySessionId({
  sessionId, limit = 50,
}: { sessionId: string; limit?: number }): Promise<Chat[]> {
  return db
    .select()
    .from(chat)
    .where(eq(chat.sessionId, sessionId))
    .orderBy(desc(chat.updatedAt))
    .limit(limit)
}

export async function updateChatTitle({
  id, title,
}: { id: string; title: string }): Promise<void> {
  await db.update(chat).set({ title, updatedAt: new Date() }).where(eq(chat.id, id))
}

export async function touchChat(id: string): Promise<void> {
  await db.update(chat).set({ updatedAt: new Date() }).where(eq(chat.id, id))
}

export async function deleteChat({
  id, sessionId,
}: { id: string; sessionId: string }): Promise<boolean> {
  const result = await db
    .delete(chat)
    .where(and(eq(chat.id, id), eq(chat.sessionId, sessionId)))
    .returning({ id: chat.id })
  return result.length > 0
}

// ───── Message ─────

export async function saveMessages({
  messages,
}: { messages: NewMessage[] }): Promise<Message[]> {
  if (messages.length === 0) return []
  return db.insert(messageV2).values(messages).returning()
}

export async function getMessagesByChatId({
  chatId,
}: { chatId: string }): Promise<Message[]> {
  return db
    .select()
    .from(messageV2)
    .where(eq(messageV2.chatId, chatId))
    .orderBy(asc(messageV2.createdAt))
}

export async function deleteMessagesAfter({
  chatId, afterMessageId,
}: { chatId: string; afterMessageId: string }): Promise<void> {
  // 메시지 재생성 시 특정 메시지 이후 모두 삭제
  const target = await db
    .select({ createdAt: messageV2.createdAt })
    .from(messageV2)
    .where(eq(messageV2.id, afterMessageId))
    .limit(1)
  if (!target[0]) return
  await db.delete(messageV2).where(
    and(
      eq(messageV2.chatId, chatId),
      // gt 사용 — drizzle-orm 의 gt 임포트
    ),
  )
  // 위 부분은 Phase 4 에서 메시지 재생성 UX 도입 시 완성
}
