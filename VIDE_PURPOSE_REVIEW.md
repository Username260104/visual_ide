# VIDE Purpose-Fit Re-Review

Date: 2026-03-25

## Executive Summary

This app is meaningfully aligned with one half of its stated purpose and materially underpowered for the other half.

- As a visual lineage manager for many AI image variants, it is already a strong MVP.
- As a system for preserving agency tacit knowledge without loss, it is not yet structurally sufficient.

My refined judgment is:

- Version and branch management: 7.5/10
- Cognitive load reduction in small-to-medium projects: 6.5/10
- Tacit knowledge capture: 3/10
- Knowledge preservation without loss: 2.5/10
- Fit for real image editing/modification workflow: 4/10
- Overall purpose fit: 5/10

The most accurate product description today is:

> A promising visual branch-and-variant canvas for AI image exploration, but not yet a reliable institutional memory system for a branding agency.

## Scope And Method

I re-reviewed the implementation with four questions in mind:

1. Does the app reduce designer memory burden when many image versions accumulate?
2. Does it preserve order, branching, and provenance in a way that stays legible over time?
3. Does it capture decision process, reasons, and tacit knowledge at a level useful to an agency, not just an individual operator?
4. Does the actual generation/modification pipeline match the stated workflow of generating and then modifying images toward a final image?

I reviewed the Prisma schema, stores, project/node/direction APIs, graph/detail/generation UI, and generation pipeline. I also verified the app builds successfully with `npm run build`.

## Core Thesis

The app has correctly identified the right primary object: not the file, but the image node with lineage and metadata. That is the strongest architectural decision in the product.

However, the current system mainly captures:

- what image exists
- where it came from
- what branch it belongs to
- a light note or status explanation

It does not adequately capture:

- who made a decision
- when and why a decision changed
- what feedback triggered the change
- which alternatives were compared
- what was learned from rejected options
- how brand strategy or client context constrained the decision

That gap is exactly the difference between a useful version canvas and a durable tacit-knowledge repository.

## What The App Already Does Well

### 1. It models version lineage explicitly instead of relying on folders or filenames

The `Node` model stores `parentNodeId`, `directionId`, metadata, status, and canvas position. This is the right conceptual center for the problem space.

Evidence:

- `Node.parentNodeId` and `Node.directionId` in `prisma/schema.prisma:45-46`
- parent-child graph rendering in `src/components/graph/NodeGraph.tsx:84`
- parent reassignment logic in `src/components/graph/ReparentNodeDialog.tsx:54`

Why this matters:

- It externalizes relationship memory from the designer's head into the tool.
- It allows the workspace to represent branching exploration, not just a flat asset list.

### 2. It unifies imported and AI-generated images under one graph model

The app treats uploaded images and generated images as the same first-class node type with a shared graph representation.

Evidence:

- `source` field in `prisma/schema.prisma:49`
- image upload flow in `src/hooks/useImageDrop.ts`
- initial generation flow in `src/components/layout/GenerateDialog.tsx:173-181`
- variation flow in `src/components/detail/VariationPanel.tsx:176-187`

Why this matters:

- Real agency workflows are hybrid.
- Teams often mix Midjourney, Replicate outputs, Photoshop exports, and manually curated assets.
- The app correctly avoids splitting those into incompatible systems.

### 3. It reduces memory burden in the active working session

The graph, direction colors, root/child structure, right detail panel, and direct image preview all help a designer recover context quickly.

Evidence:

- graph canvas in `src/components/graph/NodeGraph.tsx`
- direction grouping in `src/components/layout/Sidebar.tsx`
- node preview and metadata in `src/components/graph/ImageNode.tsx`
- detail panel lineage and metadata in `src/components/detail/DetailPanel.tsx`

This is the strongest proof that the product is directionally correct.

## Where The App Falls Short Against The Stated Purpose

### 1. It captures current state, not decision history

This is the single biggest structural gap.

Node edits overwrite the current record in place. There is no separate event log, audit trail, review record, comparison record, or feedback entity.

Evidence:

- only three domain models exist: `Project`, `Direction`, `Node` in `prisma/schema.prisma:10`, `:24`, `:38`
- node PATCH mutates fields directly in `src/app/api/projects/[id]/nodes/[nodeId]/route.ts:53-68`
- direction PATCH mutates fields directly in `src/app/api/projects/[id]/directions/[dirId]/route.ts:11-18`

Implication:

- If a note changes, the prior note is gone.
- If a status changes from `promising` to `dropped`, the transition itself is not recorded.
- If a direction assignment changes, the reason for the reclassification is lost.

This means the app is not yet preserving tacit knowledge "without loss". It is preserving only the latest visible state.

### 2. Decision rationale is too thin to represent agency knowledge

The knowledge layer on each node is currently limited to:

- `intentTags`
- `changeTags`
- `note`
- `statusReason`

Evidence:

- node metadata fields in `prisma/schema.prisma:60-66`
- note editing in `src/components/detail/DetailPanel.tsx:149-155`
- status reason gating in `src/components/detail/StatusSelector.tsx:25-31` and `:97`

Why this is insufficient:

- Agency tacit knowledge is not just "why final" or "why dropped".
- It includes client reactions, internal critique, strategic constraints, brand fit criteria, and lessons learned across branches.
- None of those are modeled as first-class objects.

The current design will accumulate fragmented annotations, not reusable organizational intelligence.

### 3. The app does not know who did what

I did not find user identity, actor attribution, or collaborative authorship fields in the data model or API layer.

Evidence:

- no `userId`, `createdBy`, `updatedBy`, `reviewer`, `author`, or collaboration entities found in app code or schema

Implication:

- A branding agency cannot later answer "who made this call", "whose feedback was this", or "which art director rejected this branch".
- Without actor attribution, tacit knowledge remains anonymous and weakly actionable.

### 4. "Modification" is not truly image editing in the current pipeline

The stated purpose describes generating and modifying images toward a final image. The implementation mostly produces new prompt-based variants rather than editing an existing image with the source image as conditioning input.

Evidence:

- variation request sends `parentPrompt`, tags, note, model, ratio; not the parent image itself in `src/components/detail/VariationPanel.tsx:160-167`
- variation API builds a new prompt and a fresh generation input in `src/app/api/generate-variation/route.ts:35-50`
- generation input builder only sets text prompt and size-related fields in `src/lib/imageGeneration.ts:98-121`
- model definitions include `supportsImg2Img`, but I did not find an implementation that uses that capability in the pipeline; see `src/lib/constants.ts:67`

Implication:

- The app currently supports branching ideation better than true iterative image modification.
- For brand production workflows, that is a meaningful mismatch.

### 5. Reproducibility is materially incomplete

The schema has a `seed` field, but the actual generation flows do not persist seed values from generated outputs. They also do not persist several generation parameters that materially affect reproducibility.

Evidence:

- schema supports `seed` in `prisma/schema.prisma:51`
- node create accepts `seed` in `src/app/api/projects/[id]/nodes/route.ts:52`
- detail panel can display seed in `src/components/detail/DetailPanel.tsx:437-438`
- generate-image API returns only `imageUrls` in `src/app/api/generate-image/route.ts:59`
- generate dialog stores prompt/model/aspect ratio/size, but not guidance, steps, resolution, replicate ID, or seed in `src/components/layout/GenerateDialog.tsx:154-180`
- variation flow stores prompt/model/aspect ratio/tags/note, but not seed or deeper execution parameters in `src/components/detail/VariationPanel.tsx:176-187`

Implication:

- The app cannot reliably recreate many previously generated outputs.
- That weakens its value as a long-term agency memory system.

### 6. Branch labels are visual buckets, not knowledge-bearing directions

`Direction` stores only `name` and `color`.

Evidence:

- `Direction` schema in `prisma/schema.prisma:24-34`
- creation UI in `src/components/layout/DirectionDialog.tsx`

Implication:

- A direction currently means "colored grouping label", not "codified strategic branch".
- There is no place to store direction thesis, target emotion, brand fit criteria, risks, or usage guidance.

This is a major lost opportunity because direction objects should be one of the strongest containers of agency tacit knowledge.

### 7. Brand and project context are not operationalized

Projects do have `name`, `description`, and `thumbnailUrl`, but that context is not meaningfully connected to generation or review workflows. The settings area is also explicitly a placeholder.

Evidence:

- project fields in `prisma/schema.prisma:12-16`
- project description is created and displayed, but not used in generation logic
- settings placeholder in `src/components/layout/Sidebar.tsx:170`
- thumbnail is displayed in project cards but I did not find automatic thumbnail assignment logic; `thumbnailUrl` appears only in mapping, project card display, and project PATCH API

Implication:

- The system does not currently embed the brand brief into day-to-day decisions.
- Project context exists mostly as label text, not as an active constraint layer.

### 8. The app can lose meaning through destructive operations

This directly conflicts with the phrase "without loss".

Evidence:

- node deletion is hard delete in `src/app/api/projects/[id]/nodes/[nodeId]/route.ts:81-85`
- deleting a parent node can sever lineage because `parentNode` relation uses `onDelete: SetNull` in `prisma/schema.prisma:78`
- direction deletion clears node assignments in `src/app/api/projects/[id]/directions/[dirId]/route.ts:33-35`

Implication:

- The system can remove historically meaningful structure.
- A rejected branch may disappear instead of becoming archived institutional memory.

For this product vision, archive semantics are much more appropriate than destructive deletion.

### 9. Version numbering is not true branch sequence

New node version numbers are calculated by counting nodes in the same project and direction, not by parent-child lineage depth.

Evidence:

- version count query in `src/app/api/projects/[id]/nodes/route.ts:41`
- assignment `versionNumber: count + 1` in `src/app/api/projects/[id]/nodes/route.ts:62`
- reparent dialog explicitly says direction and version number stay the same in `src/components/graph/ReparentNodeDialog.tsx:99`

Implication:

- `v7` does not necessarily mean "the seventh step in this branch".
- For users, the label looks more semantically precise than it really is.

This is acceptable for a loose visual label, but weak for rigorous process memory.

### 10. Scale handling is not yet adequate for real agency volume

I did not find search, compare, timeline, advanced filtering, branch collapse, or review queue mechanisms. The graph renders all loaded nodes from an in-memory object map.

Evidence:

- graph builds from `Object.values(nodesById)` in `src/components/graph/NodeGraph.tsx:42`
- sidebar shows only direction counts and unclassified count in `src/components/layout/Sidebar.tsx:24-37`
- no dedicated search/compare/history/review modules found in app code

Implication:

- The app should work well for small and medium branching explorations.
- In dense agency projects, it is likely to become visually noisy and cognitively expensive again.

### 11. Project recency and final-output surfacing are weak

This is a secondary but important operational gap.

Evidence:

- project list sorts by `updatedAt` in `src/app/api/projects/route.ts:8`
- project cards display `updatedAt` and optional `thumbnailUrl` in `src/components/projects/ProjectCard.tsx:36-39` and `:96`
- I did not find node or direction mutations touching `Project.updatedAt` or automatically setting `Project.thumbnailUrl`

Inference:

- Unless there is a database trigger outside this repository, project cards may not reflect the most recent working activity when only nodes/directions change.
- Final image surfacing is also weak because final state is attached to nodes, but not elevated to project-level summary automatically.

This matters because agency memory systems need strong "what is the current best output" affordances.

### 12. Trust boundaries are inconsistent in some mutation routes

This is less about product concept and more about reliability, but it still matters because a knowledge system must be trustworthy.

Evidence:

- node PATCH verifies project membership in `src/app/api/projects/[id]/nodes/[nodeId]/route.ts:13-19`
- node DELETE does not perform the same project ownership check in `src/app/api/projects/[id]/nodes/[nodeId]/route.ts:81-85`
- direction PATCH/DELETE also do not verify route project ownership before mutation in `src/app/api/projects/[id]/directions/[dirId]/route.ts`

Implication:

- The route scoping discipline is inconsistent.
- In a multi-project or future multi-user environment, this becomes a real integrity risk.

## Refined Product Fit Assessment

### Where the app is already well aligned

- visualizing parent-child version branches
- mixing imported and generated assets in one space
- giving designers enough local context to resume work
- supporting exploration-oriented workflows

### Where the app is only partially aligned

- preserving why a branch exists
- communicating direction meaning beyond a label
- reproducing how an image was generated
- surfacing final outcomes at project level

### Where the app is not yet aligned

- preserving tacit knowledge without loss
- representing collaborative agency decision-making
- handling real image modification workflows with high fidelity
- scaling gracefully to large branch volumes

## Most Important Product Conclusion

If the goal is:

> "Help a designer not lose track of many image variants while exploring directions"

then the current app is already a meaningful success trajectory.

If the goal is:

> "Preserve the agency's branching decisions, process, reasons, and tacit knowledge without loss"

then the current architecture is still one major layer short.

That missing layer is not mainly UI polish. It is a domain-model layer for institutional memory.

## Highest-Leverage Next Moves

### Priority 1: Add a decision-memory layer

Introduce first-class records such as:

- `DecisionEvent`
- `FeedbackEvent`
- `ReviewEvent`
- `ComparisonSet`
- `ArchiveState`

Each should capture:

- actor
- timestamp
- target node or direction
- rationale
- source of feedback
- outcome
- links to compared alternatives

This single change would move the product closest to its stated purpose.

### Priority 2: Turn `Direction` into a strategic object

Expand `Direction` to include:

- thesis
- intended brand meaning
- fit criteria
- anti-goals
- notes from review
- examples / references

Right now a direction is mostly a colored tag. It should become a reusable strategic container.

### Priority 3: Add reproducibility-grade generation provenance

Persist:

- exact model ID or version
- seed
- guidance
- steps
- resolution
- aspect ratio
- source image reference for edits
- prompt transformation inputs

Without this, the app stores outcomes but not enough of the recipe.

### Priority 4: Replace destructive deletion with archive semantics

For this product, deleted knowledge is usually lost value.

Prefer:

- archived
- hidden from default view
- restorable
- lineage-preserving

over hard deletion.

### Priority 5: Implement true edit workflows

If the product promise includes "modify toward a final image", support should move beyond prompt-only variation and include actual source-image-conditioned edit flows.

### Priority 6: Add large-scale cognition tools

The graph will need:

- search
- compare
- branch collapse
- status filters
- review queue
- final candidates view
- timeline or activity stream

otherwise the cognitive burden will return at higher node counts.

## Final Verdict

This app is not misaligned with its purpose. In fact, its foundational intuition is unusually correct: representing image work as a graph of node lineage is a strong product insight.

But it currently fulfills the operational half of the purpose much better than the epistemic half.

Today it is:

- a good visual variant-management MVP
- a weak institutional-memory system

With the addition of explicit decision-memory entities, non-destructive history, reproducibility-grade provenance, and true edit workflows, it could become genuinely well matched to the stated agency use case.
