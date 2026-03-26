-- AlterTable
ALTER TABLE "projects"
ADD COLUMN "archived_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "directions"
ADD COLUMN "archived_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "nodes"
ADD COLUMN "archived_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "projects_archived_at_idx" ON "projects"("archived_at");

-- CreateIndex
CREATE INDEX "directions_project_id_archived_at_idx" ON "directions"("project_id", "archived_at");

-- CreateIndex
CREATE INDEX "nodes_project_id_archived_at_idx" ON "nodes"("project_id", "archived_at");

-- CreateIndex
CREATE INDEX "nodes_direction_id_archived_at_idx" ON "nodes"("direction_id", "archived_at");

-- CreateIndex
CREATE INDEX "nodes_parent_node_id_archived_at_idx" ON "nodes"("parent_node_id", "archived_at");
