ALTER TABLE report_attachments
ADD COLUMN IF NOT EXISTS messageid text;

ALTER TABLE report_attachments
ADD COLUMN IF NOT EXISTS sender text NOT NULL DEFAULT 'reporter';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_attachments_messageid_report_comments_id_fk'
  ) THEN
    ALTER TABLE report_attachments
    ADD CONSTRAINT report_attachments_messageid_report_comments_id_fk
    FOREIGN KEY (messageid) REFERENCES report_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS report_attachments_messageid_idx
ON report_attachments(messageid);
