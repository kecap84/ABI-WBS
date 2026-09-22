'use server'

import { db } from '@/lib/db'
import { reports, reportAttachments, reportComments } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

// Generate a unique tracking code (12 characters, alphanumeric)
function generateTrackingCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

interface SubmitReportParams {
  title: string
  description: string
  category: string
  severity: string
  department?: string
  reporterEmail?: string
  reporterPhone?: string
}

export async function submitReport(params: SubmitReportParams) {
  try {
    console.log('[v0] Submitting report:', { title: params.title, category: params.category })
    
    const trackingCode = generateTrackingCode()
    const reportId = nanoid()

    console.log('[v0] Generated trackingCode:', trackingCode)

    const result = await db.insert(reports).values({
      id: reportId,
      trackingCode,
      title: params.title,
      description: params.description,
      category: params.category,
      severity: params.severity,
      department: params.department,
      reporterEmail: params.reporterEmail,
      reporterPhone: params.reporterPhone,
      status: 'open',
    })

    console.log('[v0] Report inserted successfully:', reportId)

    return {
      success: true,
      trackingCode,
      reportId,
    }
  } catch (error) {
    console.error('[v0] Error submitting report:', error)
    return {
      success: false,
      error: 'Gagal mengirimkan laporan. Silakan coba lagi.',
    }
  }
}

export async function getReportByTrackingCode(trackingCode: string) {
  try {
    const normalizedTrackingCode = trackingCode.trim().toUpperCase()
    if (!normalizedTrackingCode) return null

    const report = await db
      .select()
      .from(reports)
      .where(eq(reports.trackingCode, normalizedTrackingCode))
      .limit(1)

    if (!report || report.length === 0) {
      return null
    }

    const messages = await db
      .select()
      .from(reportComments)
      .where(eq(reportComments.reportId, report[0].id))
      .orderBy(asc(reportComments.createdAt))

    const attachments = await db
      .select({
        id: reportAttachments.id,
        fileName: reportAttachments.fileName,
        fileType: reportAttachments.fileType,
        fileSize: reportAttachments.fileSize,
        messageId: reportAttachments.messageId,
        sender: reportAttachments.sender,
        uploadedAt: reportAttachments.uploadedAt,
      })
      .from(reportAttachments)
      .where(eq(reportAttachments.reportId, report[0].id))

    return {
      ...report[0],
      messages,
      attachments,
    }
  } catch (error) {
    console.error('[v0] Error fetching report:', error)
    throw new Error('Unable to load the report right now')
  }
}

export async function getAllReports() {
  try {
    const allReports = await db.select().from(reports)
    return allReports
  } catch (error) {
    console.error('[v0] Error fetching reports:', error)
    return []
  }
}
