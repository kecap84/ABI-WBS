'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, AlertCircle, Bell, Filter, Eye, Settings, Trash2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface Report {
  id: string
  trackingCode: string
  title: string
  description: string
  category: string
  status: string
  unreadReplyCount: number
  reportDate: string
  adminNotes?: string | null
  createdAt: string
}

interface Stats {
  total: number
  open: number
  inProgress: number
  awaitingInformation: number
  resolved: number
  newReplies: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, open: 0, inProgress: 0, awaitingInformation: 0, resolved: 0, newReplies: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (reports.length > 0) {
      loadReports()
    }
  }, [statusFilter, categoryFilter])

  useEffect(() => {
    const refresh = () => loadReports(false)
    const interval = window.setInterval(refresh, 30000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [statusFilter, categoryFilter])

  const checkAuth = async () => {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      router.push('/admin/login')
      return
    }
    loadReports()
  }

  const loadReports = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      const token = localStorage.getItem('adminToken')
      
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (categoryFilter) params.append('category', categoryFilter)

      const response = await fetch(`/api/admin/reports?${params}`, {
        headers: { 'x-admin-token': token || '' },
      })

      if (response.status === 401) {
        localStorage.removeItem('adminToken')
        router.push('/admin/login')
        return
      }

      const data = await response.json()
      setReports(data.reports || [])

      // Calculate stats
      const stats = {
        total: data.total,
        open: data.reports.filter((r: Report) => r.status === 'open').length,
        inProgress: data.reports.filter((r: Report) => r.status === 'in_progress').length,
        awaitingInformation: data.reports.filter((r: Report) => r.status === 'awaiting_information').length,
        resolved: data.reports.filter((r: Report) => r.status === 'resolved').length,
        newReplies: data.totalUnreadReplies || 0,
      }
      setStats(stats)
    } catch (err) {
      setError('Failed to load reports')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    router.push('/')
  }

  const handleDelete = async (report: Report) => {
    const confirmed = window.confirm(
      `Delete report "${report.title}" (${report.trackingCode})? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      setDeletingReportId(report.id)
      setError('')

      const token = localStorage.getItem('adminToken')
      const response = await fetch('/api/admin/reports', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token || '',
        },
        body: JSON.stringify({ reportId: report.id }),
      })

      if (response.status === 401) {
        localStorage.removeItem('adminToken')
        router.push('/admin/login')
        return
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete report')
      }

      await loadReports()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report')
    } finally {
      setDeletingReportId(null)
    }
  }

  const filteredReports = reports.filter(report =>
    report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.trackingCode.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-900/20 text-blue-200 border-blue-800'
      case 'in_progress':
        return 'bg-purple-900/20 text-purple-200 border-purple-800'
      case 'awaiting_information':
        return 'bg-yellow-900/20 text-yellow-200 border-yellow-800'
      case 'resolved':
        return 'bg-green-900/20 text-green-200 border-green-800'
      case 'closed':
        return 'bg-slate-900/20 text-slate-200 border-slate-800'
      default:
        return 'bg-slate-900/20 text-slate-200 border-slate-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Pending Review'
      case 'in_progress':
      case 'investigating':
        return 'In Progress'
      case 'awaiting_information':
        return 'Awaiting Information'
      case 'resolved':
        return 'Resolved'
      case 'closed':
        return 'Closed'
      default:
        return status
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900 to-emerald-800 border-b border-green-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo-Abhitech-WKYuLp4lUYbxjEWZoDP9cQw60WckgV.webp"
              alt="Abhitech"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-white">Reports Dashboard</h1>
              <p className="text-green-100 mt-1 text-xs sm:text-base">Manage whistleblowing reports</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white" title="Unread reporter replies">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">New replies</span>
              {stats.newReplies > 0 && (
                <span className="min-w-5 rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-xs font-bold text-slate-900">
                  {stats.newReplies > 99 ? '99+' : stats.newReplies}
                </span>
              )}
            </div>
            <Link
              href="/admin/settings"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg transition transform hover:scale-105 text-sm sm:text-base"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-2 rounded-lg transition transform hover:scale-105 text-sm sm:text-base"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-6 hover:bg-white/10 transition">
            <p className="text-blue-200 text-sm font-semibold">Total Reports</p>
            <p className="text-4xl font-bold text-white mt-2">{stats.total}</p>
          </div>
          <div className="bg-blue-500/10 backdrop-blur border border-blue-500/20 rounded-lg p-6 hover:bg-blue-500/20 transition">
            <p className="text-blue-200 text-sm font-semibold">Pending Review</p>
            <p className="text-4xl font-bold text-blue-100 mt-2">{stats.open}</p>
          </div>
          <div className="bg-purple-500/10 backdrop-blur border border-purple-500/20 rounded-lg p-6 hover:bg-purple-500/20 transition">
            <p className="text-purple-200 text-sm font-semibold">In Progress</p>
            <p className="text-4xl font-bold text-purple-100 mt-2">{stats.inProgress}</p>
          </div>
          <div className="bg-yellow-500/10 backdrop-blur border border-yellow-500/20 rounded-lg p-6 hover:bg-yellow-500/20 transition">
            <p className="text-yellow-200 text-sm font-semibold">Awaiting Information</p>
            <p className="text-4xl font-bold text-yellow-100 mt-2">{stats.awaitingInformation}</p>
          </div>
          <div className="bg-green-500/10 backdrop-blur border border-green-500/20 rounded-lg p-6 hover:bg-green-500/20 transition">
            <p className="text-green-200 text-sm font-semibold">Resolved</p>
            <p className="text-4xl font-bold text-green-100 mt-2">{stats.resolved}</p>
          </div>
          <div className="bg-amber-500/10 backdrop-blur border border-amber-400/30 rounded-lg p-6 hover:bg-amber-500/20 transition">
            <p className="text-amber-200 text-sm font-semibold">New Replies</p>
            <p className="text-4xl font-bold text-amber-100 mt-2">{stats.newReplies}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-blue-300" />
            <h2 className="text-lg font-semibold text-white">Filters & Search</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Search Reports
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Title or tracking code..."
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white/20 appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-800 text-white">All Status</option>
                <option value="open" className="bg-slate-800 text-white">Pending Review</option>
                <option value="in_progress" className="bg-slate-800 text-white">In Progress</option>
                <option value="awaiting_information" className="bg-slate-800 text-white">Awaiting Information</option>
                <option value="resolved" className="bg-slate-800 text-white">Resolved</option>
                <option value="closed" className="bg-slate-800 text-white">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-400 focus:border-transparent focus:bg-white/20 appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-800 text-white">All Categories</option>
                <option value="Employee Feedback" className="bg-slate-800 text-white">Employee Feedback</option>
                <option value="Suggestion & Improvement" className="bg-slate-800 text-white">Suggestion &amp; Improvement</option>
                <option value="Workplace Concern" className="bg-slate-800 text-white">Workplace Concern</option>
                <option value="Complaint or Grievance" className="bg-slate-800 text-white">Complaint or Grievance</option>
                <option value="Workplace Harassment" className="bg-slate-800 text-white">Workplace Harassment</option>
                <option value="Discrimination" className="bg-slate-800 text-white">Discrimination</option>
                <option value="Safety Violations" className="bg-slate-800 text-white">Safety Violations</option>
                <option value="Financial Misconduct" className="bg-slate-800 text-white">Financial Misconduct</option>
                <option value="Code of Conduct Violations" className="bg-slate-800 text-white">Code of Conduct Violations</option>
                <option value="Management Abuse" className="bg-slate-800 text-white">Management Abuse</option>
                <option value="Unethical Behavior" className="bg-slate-800 text-white">Unethical Behavior</option>
                <option value="Policy Violations" className="bg-slate-800 text-white">Policy Violations</option>
                <option value="Corruption" className="bg-slate-800 text-white">Corruption</option>
                <option value="Fraud" className="bg-slate-800 text-white">Fraud</option>
                <option value="Data Privacy & Information Security" className="bg-slate-800 text-white">Data Privacy &amp; Information Security</option>
                <option value="Other" className="bg-slate-800 text-white">Other</option>
              </select>
            </div>

          </div>
        </div>

        {/* Reports Table */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/20 border border-red-500/50 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-blue-200">Loading reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-blue-200">No reports found</p>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-white/10 bg-white/10">
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-blue-200">
                      Tracking Code
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-blue-200">
                      Title
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-blue-200 hidden sm:table-cell">
                      Category
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-blue-200">
                      Replies
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-blue-200">
                      Status
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-blue-200 hidden md:table-cell">
                      Date
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-blue-200">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr
                      key={report.id}
                      className={`border-b border-white/5 transition ${report.unreadReplyCount > 0 ? 'bg-amber-400/10 hover:bg-amber-400/15' : 'hover:bg-white/10'}`}
                    >
                      <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm font-mono text-blue-300">
                        {report.trackingCode}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm text-white max-w-xs truncate">
                        {report.title}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm text-blue-100 hidden sm:table-cell">
                        {report.category}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm">
                        {report.unreadReplyCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-400/20 px-2 py-1 text-xs font-bold text-amber-100">
                            <Bell className="h-3 w-3" /> {report.unreadReplyCount} new
                          </span>
                        ) : (
                          <span className="text-xs text-blue-200/70">—</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm">
                        <span
                          className={`px-2 py-1 rounded border text-xs font-semibold ${getStatusColor(
                            report.status
                          )}`}
                        >
                          {getStatusLabel(report.status)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm text-blue-200 hidden md:table-cell">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/reports/${report.id}`}
                            className="inline-flex items-center gap-1 sm:gap-2 bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-3 py-1 rounded text-xs font-semibold transition"
                          >
                            <Eye className="w-3 h-3" />
                            <span className="hidden sm:inline">View</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(report)}
                            disabled={deletingReportId === report.id}
                            className="inline-flex items-center gap-1 sm:gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed text-white px-2 sm:px-3 py-1 rounded text-xs font-semibold transition"
                            aria-label={`Delete report ${report.trackingCode}`}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden sm:inline">
                              {deletingReportId === report.id ? 'Deleting...' : 'Delete'}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
