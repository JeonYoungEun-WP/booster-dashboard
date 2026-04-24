'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Download, Loader2, FileSpreadsheet } from 'lucide-react'
import type { EventAnalyticsResponse } from '@/src/lib/event-analytics-service'

interface Props {
  open: boolean
  onClose: () => void
  data: EventAnalyticsResponse | null
}

export function ReportModeDialog({ open, onClose, data }: Props) {
  const [pptBusy, setPptBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [xlsxBusy, setXlsxBusy] = useState(false)
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

  const handleXlsxDownload = async () => {
    if (!data) return
    setXlsxBusy(true)
    setError(null)
    try {
      const { buildReportXlsx, downloadBlob } = await import('@/src/lib/report-builder-xlsx')
      const blob = buildReportXlsx({ data })
      downloadBlob(blob, `${fileStem}.xlsx`)
    } catch (e) {
      setError(`Excel 생성 실패: ${(e as Error).message}`)
    } finally {
      setXlsxBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
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

        {/* 본문 — 간단 안내만 */}
        <div className="px-6 py-5">
          <p className="text-sm text-muted-foreground">
            원하는 포맷으로 내려받으세요. <strong className="text-foreground">PPT</strong> 는 편집 가능,{' '}
            <strong className="text-foreground">PDF</strong> 는 시각 리포트, <strong className="text-foreground">Excel</strong> 은 원본 데이터(멀티시트).
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* 푸터 — 다운로드 버튼 3개 */}
        <div className="px-6 py-4 border-t border-border bg-muted/20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              disabled={pptBusy || !data}
              onClick={handlePptDownload}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pptBusy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              PPT
            </button>
            <button
              type="button"
              disabled={pdfBusy || !data}
              onClick={handlePdfDownload}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfBusy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              PDF
            </button>
            <button
              type="button"
              disabled={xlsxBusy || !data}
              onClick={handleXlsxDownload}
              className="flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 px-4 py-2.5 text-sm font-semibold hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {xlsxBusy ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              Excel
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {pptBusy && 'PPT 생성 중...'}
              {pdfBusy && 'PDF 생성 중... (화면 캡처 포함, 수 초 소요)'}
              {xlsxBusy && 'Excel 생성 중...'}
              {!pptBusy && !pdfBusy && !xlsxBusy && '클릭 즉시 다운로드됩니다.'}
            </span>
            <span>ESC · 바깥 클릭으로 닫기</span>
          </div>
        </div>
      </div>
    </div>
  )
}
