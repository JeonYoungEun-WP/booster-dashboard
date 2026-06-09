/**
 * Tailwind 클래스 머지 유틸 — shadcn/ui 표준.
 * vercel/chatbot 의 cn() 동일 시그니처.
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
