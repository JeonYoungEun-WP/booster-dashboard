/**
 * Drizzle ORM 스키마 — vercel/chatbot 마이그레이션
 *
 * 격리: booster-internal 의 Supabase Postgres 인스턴스를 공유하되,
 * 별도 schema 'chatbot' 에 테이블을 모음 (운영 데이터와 분리).
 *
 * 단순화: 인증 없음 → user 테이블 제외. 익명 sessionId 로 대화 소유권 관리.
 */

import {
  pgSchema, uuid, varchar, timestamp, json,
} from 'drizzle-orm/pg-core'

// chatbot 전용 schema (Supabase 의 다른 운영 테이블과 격리)
export const chatbot = pgSchema('chatbot')

/** 대화 단위 — 하나의 채팅 세션. */
export const chat = chatbot.table('chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  title: varchar('title', { length: 200 }).notNull(),
  // 익명 세션 ID — 쿠키 기반. 인증 도입 시 user_id 로 마이그레이션 가능.
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  visibility: varchar('visibility', { length: 16, enum: ['public', 'private'] }).notNull().default('private'),
})

/** 메시지 — AI SDK v6 의 Parts 배열을 그대로 저장 (text, tool-call, tool-result, file 등). */
export const messageV2 = chatbot.table('message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chat_id').notNull().references(() => chat.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 16, enum: ['user', 'assistant', 'system'] }).notNull(),
  parts: json('parts').notNull(),                                   // ai sdk Parts[]
  attachments: json('attachments').notNull().default([]),           // 파일 첨부 (Phase 5+에서 활성)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Chat = typeof chat.$inferSelect
export type NewChat = typeof chat.$inferInsert
export type Message = typeof messageV2.$inferSelect
export type NewMessage = typeof messageV2.$inferInsert
