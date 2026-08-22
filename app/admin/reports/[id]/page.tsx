'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, AlertCircle, Check, Download, MessageCircle, Paperclip, Send, X } from 'lucide-react'

interface Report {
  id: string
  trackingCode: string
  title: string
  description: string
  category: string
  severity: string
  department?: string | null
  status: string
  adminNotes?: string | null
  reporterEmail?: string | null
  reporterPhone?: string | null
  reportDate: string
  createdAt: string
  updatedAt: string
}

interface Message {
  id: string
  comment: string
  sender: 'admin' | 'reporter'
  createdAt: string
}

interface Attachment {
  id: string
  fileName: string
  fileType?: string | null
  fileSize: number
  uploadedAt: string
  messageId?: string | null
  sender?: 'admin' | 'reporter'
}

export default function AdminReportDetail() {
  const router = useRouter()
  const params = useParams()
  const reportId = params.id as string

  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [messageText, setMessageText] = useState('')
  const [requestInformation, setRequestInformation] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageFiles, setMessageFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null)

  useEffect(() => {
    loadReport()
  }, [reportId])

  const loadReport = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('adminToken')
      if (!token) {
        router.push('/admin/login')
        return
      }

      const response = await fetch('/api/admin/reports', {
        headers: { 'x-admin-token': token },
      })

      if (response.status === 401) {
        localStorage.removeItem('adminToken')
        router.push('/admin/login')
        return
      }

      const data = await response.json()
      const found = data.reports?.find((r: Report) => r.id === reportId)

      if (found) {
        setReport(found)
        setStatus(found.status)
        setNotes(found.adminNotes || '')
        const authenticatedHeaders = { 'x-admin-token': token }
        const [messagesResponse, attachmentsResponse] = await Promise.all([
          fetch(`/api/admin/messages?reportId=${encodeURIComponent(reportId)}`, { headers: authenticatedHeaders }),
          fetch(`/api/admin/attachments?reportId=${encodeURIComponent(reportId)}`, { headers: authenticatedHeaders }),
        ])
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json()
          setMessages(messagesData.messages || [])
        }
        if (attachmentsResponse.ok) {
          const attachmentsData = await attachmentsResponse.json()
          setAttachments(attachmentsData.attachments || [])
        }
      } else {
        setError('Report not found')
      }
    } catch (err) {
      setError('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() && messageFiles.length === 0) return

    try {
      setSendingMessage(true)
      setError('')
      const token = localStorage.getItem('adminToken')
      const response = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token || '',
        },
        body: JSON.stringify({ reportId, message: messageText, requestInformation, hasAttachments: messageFiles.length > 0 }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to send message')

      if (messageFiles.length > 0) {
        const uploadData = new FormData()
        uploadData.append('reportId', reportId)
        uploadData.append('messageId', data.messageId)
        messageFiles.forEach((file) => uploadData.append('files', file))
        const uploadResponse = await fetch('/api/conversation-attachments', {
          method: 'POST',
          headers: { 'x-admin-token': token || '' },
          body: uploadData,
        })
        const uploadResult = await uploadResponse.json()
        if (!uploadResponse.ok) throw new Error(uploadResult.error || 'Failed to upload attachments')
      }

      setMessageText('')
      setMessageFiles([])
      setRequestInformation(false)
      setStatus(data.status)
      await loadReport()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleMessageFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    if (messageFiles.length + selected.length > 3) {
      setError('Maximum 3 files are allowed per message')
      return
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    const invalid = selected.find((file) => {
      const limit = file.type === 'application/pdf' ? 2 * 1024 * 1024 : 3 * 1024 * 1024
      return !allowedTypes.includes(file.type) || file.size > limit
    })
    if (invalid) {
      setError(!allowedTypes.includes(invalid.type)
        ? `${invalid.name} has an unsupported file type`
        : `${invalid.name} exceeds the ${invalid.type === 'application/pdf' ? '2 MB PDF' : '3 MB image'} limit`)
      return
    }
    setError('')
    setMessageFiles((files) => [...files, ...selected])
  }

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/attachments/${attachment.id}?download=1`, {
        headers: { 'x-admin-token': token || '' },
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

  const previewAttachment = async (attachment: Attachment) => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/attachments/${attachment.id}`, {
        headers: { 'x-admin-token': token || '' },
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

  const handleSave = async () => {
    try {
      setSaving(true)
      setSuccess(false)
      setError('')

      const token = localStorage.getItem('adminToken')

      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token || '',
        },
        body: JSON.stringify({
          reportId,
          status,
          adminNotes: notes,
        }),
      })

      if (response.ok) {
        setSuccess(true)
        loadReport()
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError('Failed to save changes')
      }
    } catch (err) {
      setError('Error saving report')
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500/10 text-blue-200 border-blue-500/20'
      case 'in_progress':
        return 'bg-purple-500/10 text-purple-200 border-purple-500/20'
      case 'awaiting_information':
        return 'bg-yellow-500/10 text-yellow-200 border-yellow-500/20'
      case 'resolved':
        return 'bg-green-500/10 text-green-200 border-green-500/20'
      case 'closed':
        return 'bg-slate-500/10 text-slate-200 border-slate-500/20'
      default:
        return 'bg-slate-500/10 text-slate-200 border-slate-500/20'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400'
      case 'high':
        return 'text-orange-400'
      case 'medium':
        return 'text-yellow-400'
      case 'low':
        return 'text-green-400'
      default:
        return 'text-slate-400'
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <p className="text-blue-200">Loading report...</p>
      </main>
    )
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 mb-8 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-start gap-3 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error || 'Report not found'}</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 border-b border-blue-700 sticky top-0 z-40 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-100 mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white break-words">{report.title}</h1>
              <p className="text-blue-100 mt-1">
                Tracking Code: <span className="font-mono text-blue-300">{report.trackingCode}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-2 rounded border text-sm font-semibold ${getSeverityColor(report.severity)}`}>
                {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold transition transform hover:scale-105 disabled:scale-100 whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
                <span className="inline sm:hidden">{saving ? '...' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {success && (
          <div className="flex items-start gap-3 p-4 bg-green-500/20 border border-green-500/50 rounded-lg mb-6 animate-pulse">
            <Check className="w-5 h-5 text-green-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-200">Changes saved successfully</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/20 border border-red-500/50 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Report Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-6 hover:bg-white/10 transition">
              <h2 className="text-lg font-semibold text-white mb-4">Report Description</h2>
              <p className="text-blue-100 leading-relaxed whitespace-pre-wrap">{report.description}</p>
            </div>

            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Paperclip className="w-5 h-5 text-blue-300" />
                <h2 className="text-lg font-semibold text-white">Evidence</h2>
              </div>
              {attachments.filter((attachment) => !attachment.messageId).length === 0 ? (
                <p className="text-sm text-blue-200">No evidence was attached.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.filter((attachment) => !attachment.messageId).map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-lg p-2">
                      <button
                        type="button"
                        onClick={() => previewAttachment(attachment)}
                        className="min-w-0 flex-1 px-2 py-1 text-left hover:bg-white/10 rounded transition"
                      >
                        <p className="text-sm font-medium text-white truncate">{attachment.fileName}</p>
                        <p className="text-xs text-blue-200">{(attachment.fileSize / 1024 / 1024).toFixed(2)} MB · Click to preview</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadAttachment(attachment)}
                        className="p-2 text-blue-300 hover:bg-white/10 rounded transition"
                        aria-label={`Download ${attachment.fileName}`}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="w-5 h-5 text-blue-300" />
                <h2 className="text-lg font-semibold text-white">Public Conversation</h2>
              </div>
              <p className="text-xs text-blue-200 mb-4">Messages here are visible to the reporter through their tracking code.</p>

              <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                {messages.length === 0 ? (
                  <p className="text-sm text-blue-200">No messages yet.</p>
                ) : messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg p-3 border ${message.sender === 'admin' ? 'bg-blue-500/20 border-blue-400/30 ml-6' : 'bg-green-500/20 border-green-400/30 mr-6'}`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs font-semibold text-white">{message.sender === 'admin' ? 'Admin' : 'Reporter'}</span>
                      <span className="text-xs text-blue-200">{new Date(message.createdAt).toLocaleString()}</span>
                    </div>
                    {message.comment && <p className="text-sm text-white whitespace-pre-wrap break-words">{message.comment}</p>}
                    {attachments.filter((attachment) => attachment.messageId === message.id).map((attachment) => (
                      <div key={attachment.id} className="mt-2 flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/30 p-2">
                        <button type="button" onClick={() => previewAttachment(attachment)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-xs font-semibold text-white">📎 {attachment.fileName}</p>
                          <p className="text-[11px] text-blue-200">{(attachment.fileSize / 1024 / 1024).toFixed(2)} MB · Preview</p>
                        </button>
                        <button type="button" onClick={() => downloadAttachment(attachment)} className="rounded p-1.5 text-blue-200 hover:bg-white/10" aria-label={`Download ${attachment.fileName}`}>
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Write a public message to the reporter..."
                rows={4}
                maxLength={5000}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {messageFiles.map((file, index) => (
                  <span key={`${file.name}-${file.lastModified}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white">
                    <span className="max-w-52 truncate">{file.name}</span>
                    <button type="button" onClick={() => setMessageFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-400/50 bg-white/10 px-3 py-2 text-sm font-semibold text-blue-100 hover:bg-white/15">
                  <Paperclip className="h-4 w-4" /> Add files
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleMessageFiles} className="sr-only" />
                </label>
                <span className="text-xs text-blue-200">Images 3 MB · PDF 2 MB · max 3 files</span>
              </div>
              <label className="flex items-start gap-2 mt-3 text-sm text-blue-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requestInformation}
                  onChange={(e) => setRequestInformation(e.target.checked)}
                  className="mt-1"
                />
                <span>Request a reply and change status to Awaiting Information</span>
              </label>
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={sendingMessage || (!messageText.trim() && messageFiles.length === 0) || report.status === 'closed'}
                className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition"
              >
                <Send className="w-4 h-4" />
                {sendingMessage ? 'Sending...' : 'Send Message'}
              </button>
            </div>

            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Internal Investigation Notes</h2>
              <p className="text-xs text-blue-200 mb-4">Only administrators can see these notes.</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add investigation findings, discoveries, or actions taken..."
                rows={6}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white/20 resize-none"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Info Card */}
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Report Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Category</p>
                  <p className="text-white mt-2">{report.category}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Department</p>
                  <p className="text-white mt-2">{report.department || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Reporter Email</p>
                  <p className="text-white mt-2 break-all">{report.reporterEmail || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Reporter Phone</p>
                  <p className="text-white mt-2">{report.reporterPhone || '-'}</p>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Status</h3>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white/20 appearance-none cursor-pointer"
              >
                <option value="open" className="bg-slate-800 text-white">Pending Review</option>
                <option value="in_progress" className="bg-slate-800 text-white">In Progress</option>
                <option value="awaiting_information" className="bg-slate-800 text-white">Awaiting Information</option>
                <option value="resolved" className="bg-slate-800 text-white">Resolved</option>
                <option value="closed" className="bg-slate-800 text-white">Closed</option>
              </select>
            </div>

            {/* Dates */}
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Timeline</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Created</p>
                  <p className="text-white text-sm mt-2">
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Updated</p>
                  <p className="text-white text-sm mt-2">
                    {new Date(report.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`}>
          <div className="w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/10">
              <p className="text-sm font-semibold text-white truncate">{preview.name}</p>
              <button type="button" onClick={closePreview} className="p-2 text-white hover:bg-white/10 rounded-lg" aria-label="Close preview">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-[80vh] bg-slate-950 flex items-center justify-center">
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
