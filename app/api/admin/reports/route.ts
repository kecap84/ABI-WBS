import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { reportAttachments, reportComments, reports } from '@/lib/db/schema'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { del } from '@vercel/blob'

// Simple admin token validation (in production, use proper auth)
function validateAdminToken(req: NextRequest): boolean {
  const adminToken = process.env.ADMIN_TOKEN
  const token = req.headers.get('x-admin-token') || ''
  return Boolean(adminToken) && token === adminToken
}

export async function GET(req: NextRequest) {
  if (!validateAdminToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = db.select().from(reports).$dynamic()

    // Apply filters
    const filters = []
    if (status === 'in_progress') {
      filters.push(sql`status IN ('in_progress', 'investigating')`)
    } else if (status) {
      filters.push(sql`status = ${status}`)
    }
    if (category) filters.push(sql`category = ${category}`)

    if (filters.length > 0) {
      const whereClause = sql.join(filters, sql` AND `)
      query = query.where(whereClause)
    }

    const allReports = await query
      .orderBy(sql`createdat DESC`)
      .limit(limit)
      .offset(offset)

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(reports)

    const unreadRows = await db
      .select({
        reportId: reportComments.reportId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(reportComments)
      .where(and(
        eq(reportComments.sender, 'reporter'),
        isNull(reportComments.adminReadAt)
      ))
      .groupBy(reportComments.reportId)

    const unreadByReport = new Map(
      unreadRows.map((row) => [row.reportId, Number(row.count)])
    )
    const totalUnreadReplies = unreadRows.reduce(
      (total, row) => total + Number(row.count),
      0
    )

    const normalizedReports = allReports.map((report) => ({
      ...report,
      status: report.status === 'investigating' ? 'in_progress' : report.status,
      unreadReplyCount: unreadByReport.get(report.id) || 0,
    }))

    return NextResponse.json({
      reports: normalizedReports,
      total: countResult[0]?.count || 0,
      totalUnreadReplies,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[v0] Error fetching reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  if (!validateAdminToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { reportId, status, adminNotes } = await req.json()

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    const allowedStatuses = ['open', 'in_progress', 'awaiting_information', 'resolved', 'closed']
    if (status && !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updateData: Partial<typeof reports.$inferInsert> = { updatedAt: new Date() }
    if (status) updateData.status = status
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes

    await db
      .update(reports)
      .set(updateData)
      .where(sql`id = ${reportId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Error updating report:', error)
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  if (!validateAdminToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { reportId } = await req.json()

    if (typeof reportId !== 'string' || !reportId.trim()) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    const attachments = await db
      .select({ pathname: reportAttachments.fileUrl })
      .from(reportAttachments)
      .where(eq(reportAttachments.reportId, reportId))

    if (attachments.length > 0) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
          { error: 'Evidence storage is not configured; files cannot be safely deleted' },
          { status: 503 }
        )
      }
      await del(attachments.map((attachment) => attachment.pathname))
    }

    const deletedReports = await db
      .delete(reports)
      .where(eq(reports.id, reportId))
      .returning({ id: reports.id })

    if (deletedReports.length === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Error deleting report:', error)
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    )
  }
}
