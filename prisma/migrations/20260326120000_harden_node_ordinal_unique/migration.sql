ALTER TABLE "nodes"
ALTER COLUMN "node_ordinal" SET NOT NULL;

DROP INDEX IF EXISTS "nodes_project_id_node_ordinal_idx";

CREATE UNIQUE INDEX "nodes_project_id_node_ordinal_key"
ON "nodes" ("project_id", "node_ordinal");
