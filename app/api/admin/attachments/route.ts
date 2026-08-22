import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { reportAttachments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

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
    .where(eq(reportAttachments.reportId, reportId))

  return NextResponse.json({ attachments })
}
