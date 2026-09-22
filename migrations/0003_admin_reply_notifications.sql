ALTER TABLE report_comments
ADD COLUMN IF NOT EXISTS adminreadat timestamp;

CREATE INDEX IF NOT EXISTS report_comments_unread_admin_idx
ON report_comments (reportid, adminreadat)
WHERE sender = 'reporter';
