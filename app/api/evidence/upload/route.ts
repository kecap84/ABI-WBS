import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { db } from '@/lib/db'
import { reportAttachments, reports } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const MAX_IMAGE_SIZE = 3 * 1024 * 1024
const MAX_PDF_SIZE = 2 * 1024 * 1024
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

interface EvidencePayload {
  attachmentId: string
  reportId: string
  trackingCode: string
  originalName: string
  fileSize: number
  fileType: string
}

function getMaximumFileSize(fileType: string) {
  return fileType === 'application/pdf' ? MAX_PDF_SIZE : MAX_IMAGE_SIZE
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Evidence storage is not configured' }, { status: 503 })
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!clientPayload) throw new Error('Missing upload authorization')
        const payload = JSON.parse(clientPayload) as EvidencePayload

        if (
          !payload.attachmentId ||
          !payload.reportId ||
          !payload.trackingCode ||
          !payload.originalName ||
          !ALLOWED_FILE_TYPES.includes(payload.fileType) ||
          !Number.isFinite(payload.fileSize) ||
          payload.fileSize <= 0 ||
          payload.fileSize > getMaximumFileSize(payload.fileType)
        ) {
          throw new Error('Invalid evidence metadata')
        }

        const report = await db
          .select({ id: reports.id })
          .from(reports)
          .where(eq(reports.id, payload.reportId))
          .limit(1)
        if (report.length === 0) throw new Error('Report not found')

        const trackingReport = await db
          .select({ id: reports.id })
          .from(reports)
          .where(eq(reports.trackingCode, payload.trackingCode.toUpperCase()))
          .limit(1)
        if (trackingReport[0]?.id !== payload.reportId) throw new Error('Invalid tracking code')

        const existingAttachments = await db
          .select({ id: reportAttachments.id })
          .from(reportAttachments)
          .where(eq(reportAttachments.reportId, payload.reportId))
        if (existingAttachments.length >= 3) throw new Error('Maximum evidence file count reached')

        return {
          allowedContentTypes: [payload.fileType],
          maximumSizeInBytes: getMaximumFileSize(payload.fileType),
          addRandomSuffix: true,
          cacheControlMaxAge: 60,
          validUntil: Date.now() + 10 * 60 * 1000,
          tokenPayload: JSON.stringify(payload),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) throw new Error('Missing evidence metadata')
        const payload = JSON.parse(tokenPayload) as EvidencePayload
        await db
          .insert(reportAttachments)
          .values({
            id: payload.attachmentId,
            reportId: payload.reportId,
            fileName: payload.originalName.slice(0, 255),
            fileUrl: blob.pathname,
            fileType: blob.contentType,
            fileSize: payload.fileSize,
          })
          .onConflictDoNothing({ target: reportAttachments.id })
      },
    })

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Evidence upload failed' },
      { status: 400 }
    )
  }
}
