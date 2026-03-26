CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "node_id" TEXT,
    "direction_id" TEXT,
    "kind" TEXT NOT NULL,
    "actor_type" TEXT,
    "actor_label" TEXT,
    "source" TEXT NOT NULL DEFAULT 'system',
    "summary" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_events_project_id_created_at_idx" ON "activity_events"("project_id", "created_at");
CREATE INDEX "activity_events_project_id_kind_idx" ON "activity_events"("project_id", "kind");
CREATE INDEX "activity_events_node_id_created_at_idx" ON "activity_events"("node_id", "created_at");
CREATE INDEX "activity_events_direction_id_created_at_idx" ON "activity_events"("direction_id", "created_at");

ALTER TABLE "activity_events"
ADD CONSTRAINT "activity_events_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activity_events"
ADD CONSTRAINT "activity_events_node_id_fkey"
FOREIGN KEY ("node_id") REFERENCES "nodes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activity_events"
ADD CONSTRAINT "activity_events_direction_id_fkey"
FOREIGN KEY ("direction_id") REFERENCES "directions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
