export type NodeStatus =
  | 'unclassified'
  | 'reviewing'
  | 'promising'
  | 'final'
  | 'dropped';

export type NodeSource = 'ai-generated' | 'imported';

export type PromptSource =
  | 'legacy'
  | 'user-authored'
  | 'ai-improved'
  | 'variation-derived';

export type StagingSourceKind = 'generate-dialog' | 'variation-panel';
export type VariationEditMode =
  | 'prompt-only'
  | 'image-to-image'
  | 'inpaint';

export type StagingCandidateStatus = 'staged' | 'accepted' | 'discarded';

export type ActivityEventKind =
  | 'node-created'
  | 'node-reparented'
  | 'node-status-changed'
  | 'node-direction-changed'
  | 'node-note-saved'
  | 'node-archived'
  | 'node-restored'
  | 'direction-archived'
  | 'direction-restored'
  | 'project-archived'
  | 'project-restored'
  | 'feedback-recorded'
  | 'decision-recorded'
  | 'comparison-recorded'
  | 'prompt-diff-summarized'
  | 'brief-updated'
  | 'direction-thesis-updated';

export type ActivityEventActorType =
  | 'system'
  | 'designer'
  | 'director'
  | 'client'
  | 'unknown';

export type ActivityEventSource = 'system' | 'manual';

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue }
  | JsonValue[];

export interface Project {
  id: string;
  name: string;
  description: string;
  brief: string;
  constraints: string;
  targetAudience: string;
  brandTone: string;
  thumbnailUrl: string | null;
  createdAt: number;
  updatedAt: number;
  nodeCount?: number;
  directionCount?: number;
}

export interface NodeData {
  id: string;
  projectId: string;
  imageUrl: string;
  createdAt: number;

  // Lineage
  parentNodeId: string | null;
  directionId: string | null;

  // Source
  source: NodeSource;
  prompt: string | null;
  userIntent?: string | null;
  resolvedPrompt?: string | null;
  promptSource?: PromptSource | null;
  seed: number | null;
  modelUsed?: string | null;
  width?: number | null;
  height?: number | null;
  aspectRatio?: string | null;

  // Intent
  intentTags: string[];
  changeTags: string[];
  note: string;

  // Status
  status: NodeStatus;
  statusReason: string | null;

  // Auto
  nodeOrdinal?: number | null;
  versionNumber: number;

  // Position on canvas
  position: { x: number; y: number };
}

export interface Direction {
  id: string;
  projectId: string;
  name: string;
  color: string;
  thesis: string;
  fitCriteria: string;
  antiGoal: string;
  referenceNotes: string;
  nodeCount: number;
}

export interface ActivityEventData {
  id: string;
  projectId: string;
  nodeId: string | null;
  directionId: string | null;
  kind: ActivityEventKind;
  actorType: ActivityEventActorType | null;
  actorLabel: string | null;
  source: ActivityEventSource;
  summary: string | null;
  payload: JsonValue;
  createdAt: number;
}

export interface ActivityEventCursor {
  id: string;
  createdAt: number;
}

export interface ActivityEventPage {
  events: ActivityEventData[];
  nextCursor: ActivityEventCursor | null;
  hasMore: boolean;
}

export interface StagingCandidate {
  id: string;
  imageUrl: string;
  index: number;
  selected: boolean;
  status: StagingCandidateStatus;
}

export interface StagingBatch {
  id: string;
  sourceKind: StagingSourceKind;
  projectId: string;
  parentNodeId: string | null;
  directionId: string | null;
  userIntent: string | null;
  resolvedPrompt: string | null;
  promptSource: PromptSource | null;
  modelId: string | null;
  modelLabel: string | null;
  aspectRatio: string | null;
  width: number | null;
  height: number | null;
  variationMode: VariationEditMode | null;
  sourceImageUrl: string | null;
  maskImageUrl: string | null;
  intentTags: string[];
  changeTags: string[];
  note: string | null;
  createdAt: number;
  candidates: StagingCandidate[];
}
