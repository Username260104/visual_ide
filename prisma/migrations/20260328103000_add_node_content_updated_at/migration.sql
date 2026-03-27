ALTER TABLE "nodes"
ADD COLUMN "content_updated_at" TIMESTAMP(3);

UPDATE "nodes"
SET "content_updated_at" = "created_at"
WHERE "content_updated_at" IS NULL;

ALTER TABLE "nodes"
ALTER COLUMN "content_updated_at" SET NOT NULL,
ALTER COLUMN "content_updated_at" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "nodes_project_id_archived_at_content_updated_at_node_ordinal_idx"
ON "nodes" ("project_id", "archived_at", "content_updated_at", "node_ordinal");
