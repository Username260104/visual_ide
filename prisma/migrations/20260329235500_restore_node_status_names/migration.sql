ALTER TABLE "nodes"
ALTER COLUMN "status" SET DEFAULT 'reviewing';

UPDATE "nodes"
SET "status" = CASE "status"
  WHEN 'unclassified' THEN 'reviewing'
  WHEN 'exploring' THEN 'reviewing'
  WHEN 'review' THEN 'reviewing'
  WHEN 'refining' THEN 'promising'
  WHEN 'approved' THEN 'final'
  ELSE "status"
END;
