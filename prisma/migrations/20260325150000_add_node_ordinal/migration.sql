ALTER TABLE "nodes"
ADD COLUMN "node_ordinal" INTEGER;

WITH ranked_nodes AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "project_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS "next_ordinal"
  FROM "nodes"
)
UPDATE "nodes" AS target
SET "node_ordinal" = ranked_nodes."next_ordinal"
FROM ranked_nodes
WHERE target."id" = ranked_nodes."id";

CREATE INDEX "nodes_project_id_node_ordinal_idx"
ON "nodes" ("project_id", "node_ordinal");
