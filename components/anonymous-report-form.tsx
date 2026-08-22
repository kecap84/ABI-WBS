'use client'

import { useState } from 'react'
import { CheckCircle2, AlertCircle, Copy, Paperclip, X } from 'lucide-react'
import { upload } from '@vercel/blob/client'

const MAX_FILES = 3
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

const CATEGORIES = [
  'Employee Feedback',
  'Suggestion & Improvement',
  'Workplace Concern',
  'Complaint or Grievance',
  'Workplace Harassment',
  'Discrimination',
  'Safety Violations',
  'Financial Misconduct',
  'Code of Conduct Violations',
  'Management Abuse',
  'Unethical Behavior',
  'Policy Violations',
  'Corruption',
  'Fraud',
  'Data Privacy & Information Security',
  'Other',
]

export function AnonymousReportForm() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
  })

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [uploadWarning, setUploadWarning] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!formData.title.trim()) {
      setError('Report title cannot be empty')
      setLoading(false)
      return
    }

    if (!formData.description.trim()) {
      setError('Report description cannot be empty')
      setLoading(false)
      return
    }

    if (!formData.category) {
      setError('Please select a report category')
      setLoading(false)
      return
    }

    try {
      const submission = new FormData()
      submission.append('title', formData.title)
      submission.append('description', formData.description)
      submission.append('category', formData.category)
      submission.append('evidenceCount', evidenceFiles.length.toString())

      const response = await fetch('/api/submit-report', {
        method: 'POST',
        body: submission,
      })

      const result = await response.json()

      if (result.success && result.trackingCode) {
        let evidenceUploadFailed = false
        for (const file of evidenceFiles) {
          const attachmentId = crypto.randomUUID()
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
          try {
            await upload(`reports/${result.reportId}/${attachmentId}-${safeName}`, file, {
              access: 'private',
              handleUploadUrl: '/api/evidence/upload',
              contentType: file.type,
              clientPayload: JSON.stringify({
                attachmentId,
                reportId: result.reportId,
                trackingCode: result.trackingCode,
                originalName: file.name,
                fileSize: file.size,
              }),
            })
          } catch {
            evidenceUploadFailed = true
          }
        }

        setTrackingCode(result.trackingCode)
        setUploadWarning(
          evidenceUploadFailed
            ? 'Your report was submitted, but one or more evidence files could not be uploaded. Please save your tracking code and contact the administrator if needed.'
            : null
        )
        setSubmitted(true)
        setFormData({
          title: '',
          description: '',
          category: '',
        })
        setEvidenceFiles([])
      } else {
        setError(result.error || 'An error occurred while submitting the report')
      }
    } catch (err) {
      console.error('[v0] Form submission error:', err)
      setError('An error occurred while submitting the report')
    } finally {
      setLoading(false)
    }
  }

  const handleEvidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    e.target.value = ''

    if (evidenceFiles.length + selectedFiles.length > MAX_FILES) {
      setError(`You can upload a maximum of ${MAX_FILES} evidence files`)
      return
    }

    const invalidFile = selectedFiles.find(
      file => !ALLOWED_FILE_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE
    )

    if (invalidFile) {
      setError(
        !ALLOWED_FILE_TYPES.includes(invalidFile.type)
          ? `${invalidFile.name} has an unsupported file type`
          : `${invalidFile.name} exceeds the 5 MB limit`
      )
      return
    }

    setError(null)
    setEvidenceFiles(files => [...files, ...selectedFiles])
  }

  const removeEvidence = (index: number) => {
    setEvidenceFiles(files => files.filter((_, fileIndex) => fileIndex !== index))
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(trackingCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 sm:p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Submission Received</h2>
          <p className="text-gray-600 mb-6 text-sm sm:text-base">
            Thank you for speaking up. Your submission has been received and will be reviewed professionally.
          </p>

          <div className="bg-white border border-green-300 rounded-lg p-6 mb-6 text-left">
            <p className="text-xs sm:text-sm text-gray-600 mb-2">Your Tracking Code:</p>
            <div className="flex items-center gap-2 justify-center flex-wrap">
              <code className="text-xl sm:text-2xl font-bold text-green-700 tracking-widest break-all">{trackingCode}</code>
              <button
                onClick={copyToClipboard}
                className="p-2 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
              >
                <Copy className={`w-5 h-5 ${copied ? 'text-green-600' : 'text-gray-400'}`} />
              </button>
            </div>
            {copied && <p className="text-xs sm:text-sm text-green-600 mt-2">Code copied to clipboard</p>}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs sm:text-sm text-gray-700 mb-2">
              <strong>Important:</strong> Save this tracking code to monitor your report status.
            </p>
            <p className="text-xs sm:text-sm text-gray-600">
              Use this code on the &quot;Track Report&quot; page to see the investigation progress.
            </p>
          </div>

          {uploadWarning && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-amber-800">{uploadWarning}</p>
            </div>
          )}

          <button
            onClick={() => {
              setSubmitted(false)
              setTrackingCode('')
              setUploadWarning(null)
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-6 sm:px-8 py-3 rounded-lg font-semibold transition text-sm sm:text-base"
          >
            Submit Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Your submission</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Tell us what you would like to share</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Feedback, ideas, concerns, or formal reports are all welcome.</p>
      </div>
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="mb-6">
        <div>
          <label htmlFor="category" className="block text-sm font-semibold text-gray-900 mb-2">
            Report Category <span className="text-red-600">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:text-base"
          >
            <option value="" className="text-gray-400">Select a category...</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat} className="text-gray-900">{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="title" className="block text-sm font-semibold text-gray-900 mb-2">
          Title <span className="text-red-600">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={formData.title}
          onChange={handleChange}
          required
          placeholder="Briefly summarize your feedback or report"
          maxLength={200}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:text-base"
        />
        <p className="text-xs text-gray-500 mt-1">{formData.title.length}/200</p>
      </div>

      <div className="mb-6">
        <label htmlFor="description" className="block text-sm font-semibold text-gray-900 mb-2">
          Details <span className="text-red-600">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
          placeholder="Describe what happened, your feedback, or your suggestion. Include dates, locations, and people when relevant."
          maxLength={5000}
          rows={8}
          className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:text-base"
        />
        <p className="text-xs text-gray-500 mt-1">{formData.description.length}/5000</p>
      </div>

      <div className="mb-6 mt-8 border-t border-slate-200 pt-6">
        <label htmlFor="evidence" className="block text-sm font-semibold text-gray-900 mb-2">
          Supporting Evidence (Optional)
        </label>
        <label
          htmlFor="evidence"
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50"
        >
          <Paperclip className="w-5 h-5 text-green-600" />
          <span className="text-sm font-semibold">Choose images or PDF</span>
        </label>
        <input
          id="evidence"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleEvidenceChange}
          className="sr-only"
        />
        <p className="text-xs text-gray-500 mt-2">Maximum 3 files, 5 MB each. JPG, PNG, WEBP, or PDF.</p>

        {evidenceFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {evidenceFiles.map((file, index) => (
              <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeEvidence(index)}
                  className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 rounded-xl bg-emerald-50 p-4">
        <p className="text-xs leading-5 text-emerald-900 sm:text-sm">
          <strong>No identity required.</strong> Save the tracking code after submitting to follow updates or reply to the review team.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:bg-slate-400 sm:text-base"
      >
        {loading ? 'Submitting...' : 'Submit Feedback or Report'}
      </button>
    </form>
  )
}
