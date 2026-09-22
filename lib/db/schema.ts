import { pgTable, text, timestamp, index, integer } from 'drizzle-orm/pg-core'

// Anonymous Speak Up System Tables
export const reports = pgTable(
  'reports',
  {
    id: text('id').primaryKey(),
    trackingCode: text('trackingcode').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    severity: text('severity').notNull().default('medium'),
    department: text('department'),
    reporterEmail: text('reporteremail'),
    reporterPhone: text('reporterphone'),
    reportDate: timestamp('reportdate').notNull().defaultNow(),
    status: text('status').notNull().default('open'),
    adminNotes: text('adminnotes'),
    createdAt: timestamp('createdat').notNull().defaultNow(),
    updatedAt: timestamp('updatedat').notNull().defaultNow(),
  },
  (table) => ({
    trackingCodeIdx: index('reports_trackingcode_idx').on(table.trackingCode),
    statusIdx: index('reports_status_idx').on(table.status),
    createdAtIdx: index('reports_createdat_idx').on(table.createdAt),
  })
)

export const reportResponses = pgTable(
  'report_responses',
  {
    id: text('id').primaryKey(),
    reportId: text('reportid')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    response: text('response').notNull(),
    responseDate: timestamp('responsedate').notNull().defaultNow(),
    createdAt: timestamp('createdat').notNull().defaultNow(),
    updatedAt: timestamp('updatedat').notNull().defaultNow(),
  },
  (table) => ({
    reportIdIdx: index('report_responses_reportid_idx').on(table.reportId),
  })
)

export const reportAttachments = pgTable(
  'report_attachments',
  {
    id: text('id').primaryKey(),
    reportId: text('reportid')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    fileName: text('filename').notNull(),
    fileUrl: text('fileurl').notNull(),
    fileType: text('filetype'),
    fileSize: integer('filesize').notNull().default(0),
    messageId: text('messageid'),
    sender: text('sender').notNull().default('reporter'),
    uploadedAt: timestamp('uploadedat').notNull().defaultNow(),
    createdAt: timestamp('createdat').notNull().defaultNow(),
  },
  (table) => ({
    reportIdIdx: index('report_attachments_reportid_idx').on(table.reportId),
    messageIdIdx: index('report_attachments_messageid_idx').on(table.messageId),
  })
)

export const reportComments = pgTable(
  'report_comments',
  {
    id: text('id').primaryKey(),
    reportId: text('reportid')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    comment: text('comment').notNull(),
    sender: text('sender').notNull().default('admin'),
    adminReadAt: timestamp('adminreadat'),
    createdAt: timestamp('createdat').notNull().defaultNow(),
    updatedAt: timestamp('updatedat').notNull().defaultNow(),
  },
  (table) => ({
    reportIdIdx: index('report_comments_reportid_idx').on(table.reportId),
  })
)

export const adminSettings = pgTable('admin_settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value'),
  updatedAt: timestamp('updatedat').notNull().defaultNow(),
})
