import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { reportComments, reports } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const { trackingCode, message, hasAttachments } = await request.json()
    const normalizedCode = typeof trackingCode === 'string' ? trackingCode.trim().toUpperCase() : ''
    const normalizedMessage = typeof message === 'string' ? message.trim() : ''

    if (!normalizedCode || (!normalizedMessage && !hasAttachments)) {
      return NextResponse.json({ error: 'Tracking code and a message or attachment are required' }, { status: 400 })
    }
    if (normalizedMessage.length > 5000) {
      return NextResponse.json({ error: 'Message cannot exceed 5000 characters' }, { status: 400 })
    }

    const report = await db
      .select({ id: reports.id, status: reports.status })
      .from(reports)
      .where(eq(reports.trackingCode, normalizedCode))
      .limit(1)

    if (report.length === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }
    if (report[0].status === 'closed') {
      return NextResponse.json({ error: 'This conversation is closed' }, { status: 409 })
    }

    const now = new Date()
    const messageId = nanoid()
    await db.transaction(async (tx) => {
      await tx.insert(reportComments).values({
        id: messageId,
        reportId: report[0].id,
        comment: normalizedMessage,
        sender: 'reporter',
        createdAt: now,
        updatedAt: now,
      })
      await tx
        .update(reports)
        .set({ status: 'in_progress', updatedAt: now })
        .where(eq(reports.id, report[0].id))
    })

    const messages = await db
      .select()
      .from(reportComments)
      .where(eq(reportComments.reportId, report[0].id))
      .orderBy(asc(reportComments.createdAt))

    return NextResponse.json({ success: true, messageId, messages, status: 'in_progress' })
  } catch (error) {
    console.error('[v0] Error posting reporter message:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
