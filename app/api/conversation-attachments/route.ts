import { NextRequest, NextResponse } from 'next/server'
import { del, put } from '@vercel/blob'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@/lib/db'
import { reportAttachments, reportComments, reports } from '@/lib/db/schema'

const MAX_FILES = 3
const MAX_IMAGE_SIZE = 3 * 1024 * 1024
const MAX_PDF_SIZE = 2 * 1024 * 1024
const ALLOWED_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
}

function getMaximumFileSize(fileType: string) {
  return fileType === 'application/pdf' ? MAX_PDF_SIZE : MAX_IMAGE_SIZE
}

export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Evidence storage is not configured' }, { status: 503 })
  }

  const formData = await request.formData()
  const reportId = formData.get('reportId')?.toString() || ''
  const messageId = formData.get('messageId')?.toString() || ''
  const files = formData.getAll('files').filter((value): value is File => value instanceof File && value.size > 0)
  const adminToken = request.headers.get('x-admin-token')
  const trackingCode = request.headers.get('x-tracking-code')?.trim().toUpperCase()
  const isAdmin = Boolean(process.env.ADMIN_TOKEN) && adminToken === process.env.ADMIN_TOKEN
  const sender = isAdmin ? 'admin' : 'reporter'

  if (!reportId || !messageId || files.length === 0) {
    return NextResponse.json({ error: 'Report, message, and files are required' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files are allowed per message` }, { status: 400 })
  }

  const report = await db.select({ id: reports.id, trackingCode: reports.trackingCode, status: reports.status })
    .from(reports).where(eq(reports.id, reportId)).limit(1)
  if (report.length === 0) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if (!isAdmin && (!trackingCode || trackingCode !== report[0].trackingCode)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (report[0].status === 'closed') {
    return NextResponse.json({ error: 'This conversation is closed' }, { status: 409 })
  }

  const message = await db.select({ id: reportComments.id, sender: reportComments.sender })
    .from(reportComments)
    .where(and(eq(reportComments.id, messageId), eq(reportComments.reportId, reportId)))
    .limit(1)
  if (message.length === 0 || message[0].sender !== sender) {
    return NextResponse.json({ error: 'Invalid conversation message' }, { status: 403 })
  }

  const existing = await db.select({ id: reportAttachments.id }).from(reportAttachments)
    .where(eq(reportAttachments.messageId, messageId))
  if (existing.length + files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files are allowed per message` }, { status: 400 })
  }

  for (const file of files) {
    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 400 })
    }
    if (file.size > getMaximumFileSize(file.type)) {
      return NextResponse.json({ error: `${file.name} exceeds the ${file.type === 'application/pdf' ? '2 MB PDF' : '3 MB image'} limit` }, { status: 400 })
    }
  }

  const uploadedPathnames: string[] = []
  const attachmentIds: string[] = []
  try {
    for (const file of files) {
      const attachmentId = nanoid()
      const pathname = `reports/${reportId}/messages/${messageId}/${attachmentId}-${sanitizeFileName(file.name)}`
      const blob = await put(pathname, file, { access: 'private', contentType: file.type, cacheControlMaxAge: 0 })
      uploadedPathnames.push(blob.pathname)
      attachmentIds.push(attachmentId)
      await db.insert(reportAttachments).values({
        id: attachmentId,
        reportId,
        messageId,
        sender,
        fileName: file.name.slice(0, 255),
        fileUrl: blob.pathname,
        fileType: file.type,
        fileSize: file.size,
      })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    if (uploadedPathnames.length > 0) await del(uploadedPathnames).catch(() => undefined)
    if (attachmentIds.length > 0) await db.delete(reportAttachments).where(inArray(reportAttachments.id, attachmentIds)).catch(() => undefined)
    return NextResponse.json({ error: 'Failed to upload conversation attachments' }, { status: 500 })
  }
}
