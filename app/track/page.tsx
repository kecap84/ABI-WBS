'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getReportByTrackingCode } from '@/app/actions/submit-report'
import { Search, AlertCircle, Download, FileText, Home, MessageCircle, Paperclip, Send, X } from 'lucide-react'

const STATUS_CONFIG = {
  open: { color: 'blue', label: 'Pending Review', icon: '📋' },
  pending: { color: 'yellow', label: 'Under Review', icon: '⏳' },
  in_progress: { color: 'orange', label: 'In Progress', icon: '🔍' },
  investigating: { color: 'orange', label: 'In Progress', icon: '🔍' },
  awaiting_information: { color: 'yellow', label: 'Awaiting Information', icon: '⏳' },
  resolved: { color: 'green', label: 'Resolved', icon: '✅' },
  closed: { color: 'gray', label: 'Closed', icon: '❌' },
}

const SEVERITY_CONFIG = {
  low: { color: 'green', label: 'Low' },
  medium: { color: 'yellow', label: 'Medium' },
  high: { color: 'orange', label: 'High' },
  critical: { color: 'red', label: 'Critical' },
}

export default function TrackPage() {
  const [trackingCode, setTrackingCode] = useState('')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [reply, setReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setReport(null)
    setLoading(true)
    setSearched(true)

    if (!trackingCode.trim()) {
      setError('Please enter your tracking code')
      setLoading(false)
      return
    }

    try {
      const normalizedTrackingCode = trackingCode.trim().toUpperCase()
      const foundReport = await getReportByTrackingCode(normalizedTrackingCode)
      if (foundReport) {
        setTrackingCode(normalizedTrackingCode)
        setReport(foundReport)
      } else {
        setError('Tracking code not found. Please ensure you entered the correct code.')
      }
    } catch (err) {
      setError('The report service is temporarily unavailable. Please try again shortly.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendReply = async () => {
    if ((!reply.trim() && replyFiles.length === 0) || !report) return

    try {
      setSendingReply(true)
      setError(null)
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingCode, message: reply, hasAttachments: replyFiles.length > 0 }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to send reply')

      if (replyFiles.length > 0) {
        const uploadData = new FormData()
        uploadData.append('reportId', report.id)
        uploadData.append('messageId', data.messageId)
        replyFiles.forEach((file) => uploadData.append('files', file))
        const uploadResponse = await fetch('/api/conversation-attachments', {
          method: 'POST',
          headers: { 'x-tracking-code': trackingCode.toUpperCase() },
          body: uploadData,
        })
        const uploadResult = await uploadResponse.json()
        if (!uploadResponse.ok) throw new Error(uploadResult.error || 'Failed to upload attachments')
      }

      const refreshedReport = await getReportByTrackingCode(trackingCode.toUpperCase())
      setReport(refreshedReport)
      setReply('')
      setReplyFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply')
    } finally {
      setSendingReply(false)
    }
  }

  const handleReplyFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    if (replyFiles.length + selected.length > 3) {
      setError('Maximum 3 files are allowed per message')
      return
    }
    const invalid = selected.find((file) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)
      const limit = file.type === 'application/pdf' ? 2 * 1024 * 1024 : 3 * 1024 * 1024
      return !allowed || file.size > limit
    })
    if (invalid) {
      setError(!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(invalid.type)
        ? `${invalid.name} has an unsupported file type`
        : `${invalid.name} exceeds the ${invalid.type === 'application/pdf' ? '2 MB PDF' : '3 MB image'} limit`)
      return
    }
    setError(null)
    setReplyFiles((files) => [...files, ...selected])
  }

  const downloadAttachment = async (attachment: { id: string; fileName: string }) => {
    try {
      setError(null)
      const response = await fetch(`/api/attachments/${attachment.id}?download=1`, {
        headers: { 'x-tracking-code': trackingCode.toUpperCase() },
      })
      if (!response.ok) throw new Error('Failed to download evidence')

      const fileBlob = await response.blob()
      const objectUrl = URL.createObjectURL(fileBlob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = attachment.fileName
      link.click()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download evidence')
    }
  }

  const previewAttachment = async (attachment: { id: string; fileName: string; fileType?: string | null }) => {
    try {
      setError(null)
      const response = await fetch(`/api/attachments/${attachment.id}`, {
        headers: { 'x-tracking-code': trackingCode.toUpperCase() },
      })
      if (!response.ok) throw new Error('Failed to preview evidence')

      const fileBlob = await response.blob()
      if (preview) URL.revokeObjectURL(preview.url)
      setPreview({
        url: URL.createObjectURL(fileBlob),
        type: response.headers.get('content-type') || attachment.fileType || '',
        name: attachment.fileName,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview evidence')
    }
  }

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-yellow-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo-Abhitech-WKYuLp4lUYbxjEWZoDP9cQw60WckgV.webp"
              alt="Abhitech"
              width={40}
              height={40}
              className="h-8 w-auto sm:h-10"
            />
            <span className="text-white font-bold text-sm sm:text-lg hidden sm:inline">Abhitech</span>
          </Link>
          <Link href="/" className="text-white hover:text-yellow-100 transition flex items-center gap-1 text-sm sm:text-base">
            <Home className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Back Home</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-xl border border-green-200 p-6 sm:p-8 shadow-lg mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <Search className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-4xl font-bold text-gray-900">Track Your Report</h1>
              <p className="text-gray-600 mt-2 text-sm sm:text-base">Use your tracking code to check the status of your report</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                placeholder="Enter tracking code (e.g., ABC123DEF456)"
                maxLength={12}
                className="tracking-code-input flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 caret-green-700 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase text-sm sm:text-base"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 sm:px-8 py-3 rounded-lg font-semibold transition whitespace-nowrap text-sm sm:text-base"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm sm:text-base text-red-700">{error}</p>
            </div>
          )}

          {searched && !loading && !report && !error && (
            <div className="text-center py-8">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-sm sm:text-base">No report found with that tracking code</p>
            </div>
          )}

          {report && (
            <div className="space-y-6">
              {/* Status Overview */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-2 font-semibold">Report Status</p>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl sm:text-4xl">{STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG]?.icon || '📄'}</span>
                      <span className="text-xl sm:text-3xl font-bold text-gray-900">
                        {STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG]?.label || report.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto">
                    <p className="text-xs sm:text-sm text-gray-600 mb-2 font-semibold">Tracking Code</p>
                    <p className="text-lg sm:text-2xl font-bold text-green-600 break-all">{report.trackingCode}</p>
                  </div>
                </div>
              </div>

              {/* Report Details */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 break-words">{report.title}</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1 font-semibold">Category</p>
                    <p className="font-semibold text-gray-900 text-sm sm:text-base">{report.category}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1 font-semibold">Severity</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-3 h-3 rounded-full bg-${SEVERITY_CONFIG[report.severity as keyof typeof SEVERITY_CONFIG]?.color || 'gray'}-500`} />
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">
                        {SEVERITY_CONFIG[report.severity as keyof typeof SEVERITY_CONFIG]?.label || report.severity}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1 font-semibold">Report Date</p>
                    <p className="font-semibold text-gray-900 text-sm sm:text-base">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-600 mb-2 font-semibold">Description</p>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base">{report.description}</p>
                </div>

                {report.attachments?.some((attachment: { messageId?: string | null }) => !attachment.messageId) && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Paperclip className="w-4 h-4 text-amber-700" />
                      <p className="text-sm text-amber-900 font-semibold">Submitted Evidence</p>
                    </div>
                    <div className="space-y-2">
                      {report.attachments.filter((attachment: { messageId?: string | null }) => !attachment.messageId).map((attachment: { id: string; fileName: string; fileSize: number; fileType?: string | null }) => (
                        <div key={attachment.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg p-2">
                          <button
                            type="button"
                            onClick={() => previewAttachment(attachment)}
                            className="min-w-0 flex-1 px-2 py-1 text-left hover:bg-amber-50 rounded transition"
                          >
                            <p className="text-sm font-medium text-gray-900 truncate">{attachment.fileName}</p>
                            <p className="text-xs text-gray-500">{(attachment.fileSize / 1024 / 1024).toFixed(2)} MB · Click to preview</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadAttachment(attachment)}
                            className="p-2 text-amber-700 hover:bg-amber-100 rounded transition"
                            aria-label={`Download ${attachment.fileName}`}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageCircle className="w-5 h-5 text-blue-700" />
                    <p className="text-sm sm:text-base text-blue-900 font-semibold">Conversation</p>
                  </div>

                  <div className="space-y-3 mb-4">
                    {report.messages?.length > 0 ? report.messages.map((message: { id: string; sender: string; comment: string; createdAt: string }) => (
                      <div
                        key={message.id}
                        className={`rounded-lg p-3 border ${message.sender === 'reporter' ? 'bg-green-100 border-green-200 ml-6' : 'bg-white border-blue-200 mr-6'}`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-xs font-semibold text-gray-900">{message.sender === 'reporter' ? 'You' : 'Admin'}</span>
                          <span className="text-xs text-gray-500">{new Date(message.createdAt).toLocaleString()}</span>
                        </div>
                        {message.comment && <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{message.comment}</p>}
                        {report.attachments?.filter((attachment: { messageId?: string | null }) => attachment.messageId === message.id).map((attachment: { id: string; fileName: string; fileSize: number; fileType?: string | null }) => (
                          <div key={attachment.id} className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                            <button type="button" onClick={() => previewAttachment(attachment)} className="min-w-0 flex-1 text-left">
                              <p className="truncate text-xs font-semibold text-slate-800">📎 {attachment.fileName}</p>
                              <p className="text-[11px] text-slate-500">{(attachment.fileSize / 1024 / 1024).toFixed(2)} MB · Preview</p>
                            </button>
                            <button type="button" onClick={() => downloadAttachment(attachment)} className="rounded p-1.5 text-blue-700 hover:bg-blue-50" aria-label={`Download ${attachment.fileName}`}>
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )) : (
                      <p className="text-sm text-blue-700">No messages yet.</p>
                    )}
                  </div>

                  {report.status !== 'closed' ? (
                    <div>
                      <textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Write a reply to the administrator..."
                        rows={4}
                        maxLength={5000}
                        className="w-full px-4 py-3 border border-blue-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {replyFiles.map((file, index) => (
                          <span key={`${file.name}-${file.lastModified}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-700">
                            <span className="max-w-52 truncate">{file.name}</span>
                            <button type="button" onClick={() => setReplyFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                          <Paperclip className="h-4 w-4" /> Add files
                          <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleReplyFiles} className="sr-only" />
                        </label>
                        <span className="text-xs text-blue-700">Images 3 MB · PDF 2 MB · max 3 files</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={sendingReply || (!reply.trim() && replyFiles.length === 0)}
                        className="mt-3 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition"
                      >
                        <Send className="w-4 h-4" />
                        {sendingReply ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">This conversation has been closed.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <Link href="/" className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold text-sm sm:text-base">
          ← Back to Home
        </Link>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`}>
          <div className="w-full max-w-5xl max-h-[92vh] bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-900 truncate">{preview.name}</p>
              <button type="button" onClick={closePreview} className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg" aria-label="Close preview">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-[80vh] bg-gray-950 flex items-center justify-center">
              {preview.type.startsWith('image/') ? (
                <img src={preview.url} alt={preview.name} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={preview.url} title={preview.name} className="w-full h-full bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
