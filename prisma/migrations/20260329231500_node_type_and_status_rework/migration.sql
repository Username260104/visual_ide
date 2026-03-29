ALTER TABLE "nodes"
ADD COLUMN IF NOT EXISTS "node_type" TEXT NOT NULL DEFAULT 'reference';

UPDATE "nodes"
SET "node_type" = CASE
  WHEN "source" = 'ai-generated' THEN 'main'
  ELSE 'reference'
END;

UPDATE "nodes"
SET "archived_at" = COALESCE("archived_at", NOW())
WHERE "status" = 'dropped';

UPDATE "nodes"
SET "status" = CASE "status"
  WHEN 'unclassified' THEN 'exploring'
  WHEN 'reviewing' THEN 'review'
  WHEN 'promising' THEN 'refining'
  WHEN 'final' THEN 'approved'
  WHEN 'dropped' THEN 'review'
  ELSE "status"
END;
