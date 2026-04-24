'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Download, Loader2 } from 'lucide-react'
import type { EventAnalyticsResponse } from '@/src/lib/event-analytics-service'

interface Props {
  open: boolean
  onClose: () => void
  data: EventAnalyticsResponse | null
}

const SLIDE_LIST = [
  { n: 1, title: '표지', desc: '광고주 · 기간 · 생성일' },
  { n: 2, title: '한눈에 보는 성과', desc: 'KPI 6개 (광고비 · 리드 · 예약 · 계약 · 매출 · ROAS)' },
  { n: 3, title: '광고비 → 계약 퍼널', desc: '단계별 수 · 전환율 · 획득당 비용' },
  { n: 4, title: '채널별 성과', desc: '채널 × (광고비·클릭·리드·예약·계약·CPA·ROAS)' },
  { n: 5, title: '광고세트별 성과', desc: '트래킹코드 상위 10개 상세' },
  { n: 6, title: '일자별 추이', desc: '리드·예약 분포 차트' },
  { n: 7, title: 'GA4 유입 경로', desc: '소스·매체·캠페인 상위 12개' },
  { n: 8, title: '결론 & 액션 아이템', desc: '자동 인사이트 + 편집용 placeholder' },
]

export function ReportModeDialog({ open, onClose, data }: Props) {
  const [pptBusy, setPptBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ESC 로 닫기
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const advertiser = data?.realDataNote?.advertiser ?? (data ? `이벤트 ${data.eventId}` : '')
  const periodLabel = data ? `${data.period.startDate} ~ ${data.period.endDate}` : ''
  const fileStem = data ? `boosterMAX_${data.eventId}_${data.period.startDate}_${data.period.endDate}` : 'report'

  const handlePptDownload = async () => {
    if (!data) return
    setPptBusy(true)
    setError(null)
    try {
      const { buildReportPptx, downloadBlob } = await import('@/src/lib/report-builder-pptx')
      const blob = await buildReportPptx({ data })
      downloadBlob(blob, `${fileStem}.pptx`)
    } catch (e) {
      setError(`PPT 생성 실패: ${(e as Error).message}`)
    } finally {
      setPptBusy(false)
    }
  }

  const handlePdfDownload = async () => {
    if (!data) return
    setPdfBusy(true)
    setError(null)
    try {
      const { buildReportPdf, downloadBlob } = await import('@/src/lib/report-builder-pdf')
      const blob = await buildReportPdf({ data })
      downloadBlob(blob, `${fileStem}.pdf`)
    } catch (e) {
      setError(`PDF 생성 실패: ${(e as Error).message}`)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText size={20} className="text-primary" />
              <h2 className="text-xl font-bold">리포트 모드</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                boosterMAX
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {advertiser} · {periodLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-muted"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 — 슬라이드 목차 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-sm text-muted-foreground mb-4">
            아래 8장의 슬라이드가 포함된 리포트가 생성됩니다. PPT 는 PowerPoint·Google Slides 에서 자유롭게 편집 가능.
          </p>
          <ul className="space-y-2">
            {SLIDE_LIST.map((s) => (
              <li
                key={s.n}
                className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-md bg-violet-100 text-violet-700 font-bold flex items-center justify-center shrink-0">
                  {s.n}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                </div>
              </li>
            ))}
          </ul>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* 푸터 — 다운로드 버튼 */}
        <div className="px-6 py-4 border-t border-border bg-muted/20">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              disabled={pptBusy || !data}
              onClick={handlePptDownload}
              className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pptBusy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              PPT 다운로드 (편집 가능)
            </button>
            <button
              type="button"
              disabled={pdfBusy || !data}
              onClick={handlePdfDownload}
              className="flex items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfBusy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              PDF 다운로드
            </button>
            <div className="ml-auto text-xs text-muted-foreground">
              ESC · 바깥 클릭으로 닫기
            </div>
          </div>
          {(pptBusy || pdfBusy) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {pptBusy && 'PPT 생성 중...'}
              {pdfBusy && 'PDF 생성 중... (화면 캡처 포함, 수 초 소요)'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
