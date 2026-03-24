export type NodeStatus =
  | 'unclassified'
  | 'reviewing'
  | 'promising'
  | 'final'
  | 'dropped';

export type NodeSource = 'ai-generated' | 'imported';

export interface Project {
  id: string;
  name: string;
  description: string;
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
  versionNumber: number;

  // Position on canvas
  position: { x: number; y: number };
}

export interface Direction {
  id: string;
  projectId: string;
  name: string;
  color: string;
  nodeCount: number;
}
