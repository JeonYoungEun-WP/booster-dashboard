'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Sparkles, RotateCcw } from 'lucide-react'
import {
  Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton,
} from '@/src/components/ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from '@/src/components/ai-elements/message'
import {
  PromptInput, PromptInputBody, PromptInputTextarea,
  PromptInputFooter, PromptInputSubmit, type PromptInputMessage,
} from '@/src/components/ai-elements/prompt-input'
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/src/components/ai-elements/tool'
import { Button } from '@/src/components/ui/button'
import { getOrCreateSessionIdClient, generateUUID } from '@/src/lib/session-id'
import { SuggestedQuestions } from './SuggestedQuestions'

interface Props {
  chatId?: string
  initialMessages?: never[]   // Phase 4 에서 DB 로드 메시지 주입
  apiEndpoint?: string
}

export function Chat({
  chatId: initialChatId,
  apiEndpoint = '/ai/api/chat',
}: Props) {
  const [chatId] = useState<string>(() => initialChatId ?? generateUUID())
  const [sessionId, setSessionId] = useState<string>('')

  useEffect(() => {
    setSessionId(getOrCreateSessionIdClient())
  }, [])

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: apiEndpoint,
      prepareSendMessagesRequest: ({ messages, body }) => ({
        body: { id: chatId, sessionId, messages, ...body },
      }),
    }),
    [apiEndpoint, chatId, sessionId],
  )

  const { messages, sendMessage, status, stop, regenerate } = useChat({
    id: chatId,
    transport,
  })

  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const isBusy = status === 'submitted' || status === 'streaming'

  const handlePromptSubmit = (msg: PromptInputMessage) => {
    const text = msg.text?.trim()
    if (!text) return
    sendMessage({ text })
  }

  const handlePickSuggestion = (q: string) => {
    sendMessage({ text: q })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-4xl mx-auto">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<Sparkles size={32} className="text-primary" />}
              title="ai MAX 광고 분석 챗봇"
              description="광고비·리드·예약·계약을 한 번에. 아래 예시를 누르거나 자유롭게 질문하세요."
            >
              <div className="mt-6 w-full max-w-2xl">
                <SuggestedQuestions onPick={handlePickSuggestion} />
              </div>
            </ConversationEmptyState>
          )}

          {messages.map((m) => (
            <Message key={m.id} from={m.role === 'user' ? 'user' : 'assistant'}>
              <MessageContent>
                {m.parts.map((part, idx) => {
                  if (part.type === 'text') {
                    return <MessageResponse key={idx}>{part.text}</MessageResponse>
                  }
                  if (part.type.startsWith('tool-')) {
                    const tp = part as { type: string; state: string; input?: unknown; output?: unknown }
                    const toolName = tp.type.replace(/^tool-/, '')
                    return (
                      <Tool key={idx} defaultOpen={tp.state !== 'output-available'}>
                        <ToolHeader type={`tool-${toolName}` as `tool-${string}`} state={tp.state as never} />
                        <ToolContent>
                          {tp.input !== undefined && <ToolInput input={tp.input} />}
                          {tp.output !== undefined && (
                            <ToolOutput
                              output={
                                <pre className="text-xs overflow-x-auto bg-muted/50 rounded p-2">
                                  {JSON.stringify(tp.output, null, 2)}
                                </pre>
                              }
                              errorText={undefined}
                            />
                          )}
                        </ToolContent>
                      </Tool>
                    )
                  }
                  return null
                })}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background px-4 py-3">
        {isBusy && (
          <div className="mb-2 flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={stop}>
              생성 중지
            </Button>
            <span className="text-xs text-muted-foreground animate-pulse">
              분석 중…
            </span>
          </div>
        )}
        {messages.length > 0 && !isBusy && (
          <div className="mb-2 flex items-center gap-2">
            <Button
              type="button" variant="ghost" size="sm"
              onClick={() => regenerate()}
              className="text-muted-foreground"
            >
              <RotateCcw size={13} /> 다시 답변
            </Button>
          </div>
        )}
        <PromptInput onSubmit={handlePromptSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              ref={inputRef}
              placeholder="이벤트 ID, 채널, 기간 등을 자유롭게 질문하세요…"
              disabled={isBusy}
            />
            <PromptInputFooter>
              <PromptInputSubmit status={status} />
            </PromptInputFooter>
          </PromptInputBody>
        </PromptInput>
      </div>
    </div>
  )
}
