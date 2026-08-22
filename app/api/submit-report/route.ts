import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { reportAttachments, reports } from '@/lib/db/schema'
import { del, put } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

const MAX_FILES = 3
const MAX_IMAGE_SIZE = 3 * 1024 * 1024
const MAX_PDF_SIZE = 2 * 1024 * 1024
const ALLOWED_FILE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
}

function getMaximumFileSize(fileType: string) {
  return fileType === 'application/pdf' ? MAX_PDF_SIZE : MAX_IMAGE_SIZE
}

function generateTrackingCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let body: Record<string, string | undefined>
    let files: File[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      body = {
        description: formData.get('description')?.toString(),
        category: formData.get('category')?.toString(),
        evidenceCount: formData.get('evidenceCount')?.toString(),
      }
      files = formData
        .getAll('evidence')
        .filter((value): value is File => value instanceof File && value.size > 0)
    } else {
      body = await request.json()
    }

    const { description, category, evidenceCount } = body

    if (!description?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Deskripsi laporan tidak boleh kosong' },
        { status: 400 }
      )
    }

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Silakan pilih kategori laporan' },
        { status: 400 }
      )
    }

    const generatedTitle = description.trim().replace(/\s+/g, ' ').slice(0, 120)

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_FILES} evidence files are allowed` },
        { status: 400 }
      )
    }

    for (const file of files) {
      if (!ALLOWED_FILE_TYPES.has(file.type)) {
        return NextResponse.json(
          { success: false, error: `Unsupported file type: ${file.name}` },
          { status: 400 }
        )
      }
      if (file.size > getMaximumFileSize(file.type)) {
        return NextResponse.json(
          { success: false, error: `${file.name} exceeds the ${file.type === 'application/pdf' ? '2 MB PDF' : '3 MB image'} limit` },
          { status: 400 }
        )
      }
    }

    if ((files.length > 0 || Number(evidenceCount || 0) > 0) && !process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Evidence storage is not configured yet' },
        { status: 503 }
      )
    }

    const trackingCode = generateTrackingCode()
    const reportId = nanoid()

    console.log('[v0] API: Submitting report:', { category, trackingCode })

    const uploadedPathnames: string[] = []

    try {
      await db.insert(reports).values({
        id: reportId,
        trackingCode,
        title: generatedTitle,
        description,
        category,
        severity: 'medium',
        status: 'open',
      })

      for (const file of files) {
        const safeName = sanitizeFileName(file.name)
        const pathname = `reports/${reportId}/${nanoid()}-${safeName}`
        const blob = await put(pathname, file, {
          access: 'private',
          contentType: file.type,
          cacheControlMaxAge: 0,
        })
        uploadedPathnames.push(blob.pathname)

        await db.insert(reportAttachments).values({
          id: nanoid(),
          reportId,
          fileName: file.name.slice(0, 255),
          fileUrl: blob.pathname,
          fileType: file.type,
          fileSize: file.size,
        })
      }
    } catch (error) {
      if (uploadedPathnames.length > 0) {
        await del(uploadedPathnames).catch(() => undefined)
      }
      await db.delete(reports).where(eq(reports.id, reportId)).catch(() => undefined)
      throw error
    }

    console.log('[v0] API: Report created successfully:', reportId)

    return NextResponse.json(
      {
        success: true,
        trackingCode,
        reportId,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[v0] API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal mengirimkan laporan. Silakan coba lagi.' },
      { status: 500 }
    )
  }
}
