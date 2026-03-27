# VIDE Content Thumbnail Plan

## Goal

Make the project selection card thumbnail automatically resolve to the active node whose content changed most recently, without depending on node status.

## Decision Summary

- Add a backend-only `Node.contentUpdatedAt` field.
- Treat node creation as content creation.
- Advance `contentUpdatedAt` only when persisted visual content changes.
- Derive `Project.thumbnailUrl` at read time from the latest active node ordered by `contentUpdatedAt DESC`, then `nodeOrdinal DESC`.
- Stop treating `Project.thumbnailUrl` on the `projects` table as the app's source of truth.

## Code Review Findings

### 1. Non-content edits and content edits currently share one PATCH path

File:
- `/C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/[nodeId]/route.ts`

Why it matters:
- The same route currently handles image changes, prompt changes, status changes, direction changes, parent changes, note saves, and canvas position saves.
- If thumbnail recency is tied to "any PATCH", project thumbnails will change when the user only reclassifies, drags, or reorganizes a node.

Decision:
- Thumbnail recency must be driven by an explicit content-change rule, not by generic node mutation time.

### 2. The graph auto-saves image dimensions after the image loads

File:
- `/C:/Work/Projects/Hire/visual_ide/src/components/graph/ImageNode.tsx`

Why it matters:
- `width`, `height`, and `aspectRatio` are patched after the node first renders.
- If those fields are treated as content changes, simply opening a project can accidentally advance thumbnail recency.

Decision:
- `width`, `height`, and `aspectRatio` must be excluded from content recency updates.

### 3. Project PATCH still accepts `thumbnailUrl`

File:
- `/C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/route.ts`

Why it matters:
- If project reads become node-derived while PATCH still accepts manual `thumbnailUrl`, the app ends up with two sources of truth.
- That creates ambiguous behavior and makes debugging harder.

Decision:
- The app should stop using the stored `Project.thumbnailUrl` value as authoritative.
- The cleanest v1 is to stop accepting `thumbnailUrl` updates in the project PATCH route.

### 4. Project ordering and displayed date are still based on `Project.updatedAt`

Files:
- `/C:/Work/Projects/Hire/visual_ide/src/app/api/projects/route.ts`
- `/C:/Work/Projects/Hire/visual_ide/src/components/projects/ProjectCard.tsx`

Why it matters:
- Node writes do not update `Project.updatedAt`.
- After thumbnail derivation is added, the card image can look fresh while the card date and list order still look stale.

Decision:
- This is not a blocker for thumbnail rollout.
- Keep it out of the initial scope, but document it as the next adjacent follow-up if the selector should also reflect recent node activity.

## Content Change Rule

### Count as content change

- Creating a node through `/api/projects/[id]/nodes`
- Creating a node through `/api/projects/[id]/staging/accept`
- Direct edits to `imageUrl`
- Direct edits to `prompt`
- Direct edits to `userIntent`
- Direct edits to `resolvedPrompt`

### Do not count as content change

- `status`
- `statusReason`
- `directionId`
- `parentNodeId`
- `position`
- `note`
- `width`
- `height`
- `aspectRatio`
- `source`
- `modelUsed`
- `seed`
- `promptSource`
- Archive and restore operations by themselves

### Explicit v1 choice

- Leave `intentTags` and `changeTags` out of content recency for now.
- They are currently created with new nodes, but there is no active editor path that clearly makes them a thumbnail-driving content edit.
- This avoids surprise thumbnail churn if metadata editing grows later.

## Implementation Scope

### 1. Schema and migration

Files:
- `/C:/Work/Projects/Hire/visual_ide/prisma/schema.prisma`
- `/C:/Work/Projects/Hire/visual_ide/prisma/migrations/<new_migration>/migration.sql`

Change:
- Add `contentUpdatedAt DateTime @default(now()) @map("content_updated_at")` to `Node`.
- Backfill existing rows with `created_at`.
- Add a composite index that supports "latest active node in a project" lookups.

Recommended index:
- `@@index([projectId, archivedAt, contentUpdatedAt, nodeOrdinal])`

Notes:
- `contentUpdatedAt` should be backend-only in v1. No frontend type or UI work is required unless we want debug visibility later.

### 2. Centralize content-change detection

Recommended new file:
- `/C:/Work/Projects/Hire/visual_ide/src/lib/nodeContent.ts`

Add:
- A helper that decides whether a node mutation changes content.
- A helper that compares persisted next values against the current node, not just raw request keys.

Recommended shape:

```ts
export function hasNodeContentChange(
  currentNode: {
    imageUrl: string;
    prompt: string | null;
    userIntent: string | null;
    resolvedPrompt: string | null;
  },
  nextNode: {
    imageUrl: string;
    prompt: string | null;
    userIntent: string | null;
    resolvedPrompt: string | null;
  }
) {
  return (
    currentNode.imageUrl !== nextNode.imageUrl ||
    currentNode.prompt !== nextNode.prompt ||
    currentNode.userIntent !== nextNode.userIntent ||
    currentNode.resolvedPrompt !== nextNode.resolvedPrompt
  );
}
```

Why this helper is important:
- The node PATCH route already normalizes `prompt` from `resolvedPrompt ?? prompt`.
- Content detection should happen after that normalization so that the timestamp only moves when the stored value really changes.

### 3. Update node creation paths

Files:
- `/C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/route.ts`
- `/C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/staging/accept/route.ts`

Change:
- Let new nodes receive `contentUpdatedAt` automatically from the schema default, or set it explicitly to `new Date()` for clarity.

Recommendation:
- Prefer the schema default to keep write sites smaller.
- Only set it explicitly if the team wants the intent visible in route code.

### 4. Update node PATCH behavior

File:
- `/C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/[nodeId]/route.ts`

Change:
- Build the next persisted node shape from current values plus the incoming patch.
- Call the helper from `src/lib/nodeContent.ts`.
- Only add `data.contentUpdatedAt = new Date()` when content actually changes.

Important guardrails:
- Do not update `contentUpdatedAt` for dimension sync writes from `ImageNode`.
- Do not update it for position saves from the graph.
- Do not update it for status, direction, parent, or note saves.

### 5. Derive project thumbnails on read

Recommended file:
- `/C:/Work/Projects/Hire/visual_ide/src/lib/activeRecords.ts`

Change:
- Extend the project mapping helper so it also loads the latest active node thumbnail.
- Return `thumbnailUrl` from that node's `imageUrl`.

Recommended query:

```ts
await prisma.node.findFirst({
  where: {
    projectId,
    archivedAt: null,
  },
  orderBy: [
    { contentUpdatedAt: 'desc' },
    { nodeOrdinal: 'desc' },
  ],
  select: { imageUrl: true },
});
```

Recommended response rule:
- `thumbnailUrl = latestNode?.imageUrl ?? null`

Do not do this:
- Do not merge node-derived thumbnails with stored `Project.thumbnailUrl`.
- Mixing both sources makes selector behavior harder to reason about.

### 6. Remove the dual-source project thumbnail path

File:
- `/C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/route.ts`

Change:
- Remove `thumbnailUrl` parsing from the project PATCH route.
- Do not write the `projects.thumbnail_url` column from app code anymore.

Why this is worth doing now:
- It keeps the new thumbnail behavior deterministic.
- It prevents accidental future regressions when someone assumes project PATCH still controls selector thumbnails.

### 7. Leave the database column in place for v1

Files:
- `/C:/Work/Projects/Hire/visual_ide/prisma/schema.prisma`
- `/C:/Work/Projects/Hire/visual_ide/src/lib/mappers.ts`

Decision:
- Keep `Project.thumbnailUrl` in the schema and API shape for now so the frontend does not need a contract change.
- Populate it from the derived latest-node lookup instead of the stored project column.

Why this is the least disruptive rollout:
- The card component already consumes `project.thumbnailUrl`.
- We can change the source without changing the UI contract.

## File Touchpoints

Expected code changes for the first implementation pass:

- `/C:/Work/Projects/Hire/visual_ide/prisma/schema.prisma`
- `/C:/Work/Projects/Hire/visual_ide/prisma/migrations/<new_migration>/migration.sql`
- `/C:/Work/Projects/Hire/visual_ide/src/lib/nodeContent.ts`
- `/C:/Work/Projects/Hire/visual_ide/src/lib/activeRecords.ts`
- `/C:/Work/Projects/Hire/visual_ide/src/lib/mappers.ts`
- `/C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/route.ts`
- `/C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/[nodeId]/route.ts`
- `/C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/staging/accept/route.ts`
- `/C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/route.ts`

Likely no frontend component changes are required for the initial rollout.

## Acceptance Criteria

- A newly created or accepted node becomes the project thumbnail if it is the newest content item in that project.
- Importing a new image node updates the project thumbnail.
- Changing only status, status reason, branch, parent, note, or position does not change the project thumbnail.
- Automatic width and height sync after image load does not change the project thumbnail.
- Archiving the current thumbnail node makes the next eligible active node become the thumbnail.
- Restoring a node does not fake a new content change; it only becomes the thumbnail again if its existing `contentUpdatedAt` is still the newest among active nodes.
- The project card API contract still exposes `thumbnailUrl`.

## Manual Verification Plan

### Setup

1. Run the migration and `prisma generate`.
2. Start the app and open the project selector.

### Checks

1. Create a new empty project and confirm the card shows the placeholder thumbnail.
2. Import one image into the project and confirm the project card now shows that image.
3. Import a second image and confirm the thumbnail switches to the second image.
4. Change only the second node's status and confirm the thumbnail does not change.
5. Drag the second node and confirm the thumbnail does not change.
6. Edit the second node's note and confirm the thumbnail does not change.
7. Archive the second node and confirm the thumbnail falls back to the first active node.
8. Restore the second node and confirm the thumbnail rule is based on its preserved `contentUpdatedAt`, not on restore time.
9. Accept multiple staging candidates in one batch and confirm the winner is deterministic because of the `nodeOrdinal` tie-break.
10. Accept new staging candidates later and confirm the newest accepted node wins.

## Non-Goals For This Pass

- Reordering the project selector by recent node activity
- Replacing the project card date with a node-derived activity date
- Building a manual project thumbnail picker
- Removing the `projects.thumbnail_url` column from the database

## Recommended Follow-Up After Rollout

If the selector should feel fully "recent-work aware", add a separate project activity field or update `Project.updatedAt` whenever a node content change advances `contentUpdatedAt`.



