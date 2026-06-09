/**
 * 챗봇 도메인 타입 — vercel/chatbot 의 lib/types.ts 단순화 버전.
 *
 * 자체 광고 도구를 쓰므로 weather/document/artifact 등 미사용 tool 타입은 제외.
 * Phase 4 에서 광고 도구별 InferUITool 추가 가능.
 */

import type { UIMessage, UITools } from 'ai'
import { z } from 'zod'

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
})

export type MessageMetadata = z.infer<typeof messageMetadataSchema>

// Phase 4 에서 광고 도구별 InferUITool 로 구체화될 자리
export type ChatTools = UITools

export type CustomUIDataTypes = {
  textDelta: string
  appendMessage: string
  id: string
  title: string
  clear: null
  finish: null
  'chat-title': string
}

export type ChatMessage = UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>
