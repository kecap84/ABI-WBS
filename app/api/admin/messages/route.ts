import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { reportComments, reports } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

function validateAdminToken(req: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN
  return Boolean(adminToken) && req.headers.get('x-admin-token') === adminToken
}

export async function GET(request: NextRequest) {
  if (!validateAdminToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const reportId = request.nextUrl.searchParams.get('reportId')
  if (!reportId) {
    return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
  }

  const messages = await db
    .select()
    .from(reportComments)
    .where(eq(reportComments.reportId, reportId))
    .orderBy(asc(reportComments.createdAt))

  return NextResponse.json({ messages })
}

export async function POST(request: NextRequest) {
  if (!validateAdminToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { reportId, message, requestInformation, hasAttachments } = await request.json()
    const normalizedMessage = typeof message === 'string' ? message.trim() : ''

    if (typeof reportId !== 'string' || !reportId || (!normalizedMessage && !hasAttachments)) {
      return NextResponse.json({ error: 'Report ID and a message or attachment are required' }, { status: 400 })
    }
    if (normalizedMessage.length > 5000) {
      return NextResponse.json({ error: 'Message cannot exceed 5000 characters' }, { status: 400 })
    }

    const report = await db.select({ id: reports.id, status: reports.status }).from(reports).where(eq(reports.id, reportId)).limit(1)
    if (report.length === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }
    if (report[0].status === 'closed') {
      return NextResponse.json({ error: 'This conversation is closed' }, { status: 409 })
    }

    const now = new Date()
    const messageId = nanoid()
    const nextStatus = requestInformation ? 'awaiting_information' : 'in_progress'
    await db.transaction(async (tx) => {
      await tx.insert(reportComments).values({
        id: messageId,
        reportId,
        comment: normalizedMessage,
        sender: 'admin',
        createdAt: now,
        updatedAt: now,
      })
      await tx.update(reports).set({ status: nextStatus, updatedAt: now }).where(eq(reports.id, reportId))
    })

    return NextResponse.json({ success: true, messageId, status: nextStatus })
  } catch (error) {
    console.error('[v0] Error posting admin message:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
