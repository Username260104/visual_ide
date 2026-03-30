import { getNodeSequenceLabel } from '@/lib/nodeVersioning';
import { prisma } from '@/lib/prisma';
import type { CopilotCitation } from '@/lib/types';
import type { Node, Direction, Project } from '@/generated/prisma/client';

export type ProjectCopilotContextResult =
  | {
      kind: 'ok';
      promptContext: string;
      citationIndex: Record<string, CopilotCitation>;
    }
  | { kind: 'project-not-found' }
  | { kind: 'selected-node-not-found' };

export async function buildProjectCopilotContext(
  projectId: string,
  selectedNodeId: string | null
): Promise<ProjectCopilotContextResult> {
  const [project, directions, nodes] = await prisma.$transaction([
    prisma.project.findFirst({
      where: {
        id: projectId,
        archivedAt: null,
      },
    }),
    prisma.direction.findMany({
      where: {
        projectId,
        archivedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.node.findMany({
      where: {
        projectId,
        archivedAt: null,
      },
      orderBy: [{ nodeOrdinal: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  if (!project) {
    return { kind: 'project-not-found' };
  }

  const selectedNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;

  if (selectedNodeId && !selectedNode) {
    return { kind: 'selected-node-not-found' };
  }

  const directionsById = Object.fromEntries(
    directions.map((direction) => [direction.id, direction])
  );
  const citationIndex: Record<string, CopilotCitation> = {};
  const lines: string[] = [
    '# Internal Project Data',
    'Use only the data below when answering the user question.',
  ];

  appendProjectSection(lines, citationIndex, project);
  appendDirectionSection(lines, citationIndex, directions);

  if (selectedNode) {
    appendNodeSection(
      lines,
      citationIndex,
      selectedNode,
      directionsById,
      'Selected Node'
    );
  }

  const remainingNodes = selectedNode
    ? nodes.filter((node) => node.id !== selectedNode.id)
    : nodes;

  appendNodesSection(lines, citationIndex, remainingNodes, directionsById);

  return {
    kind: 'ok',
    promptContext: lines.join('\n\n'),
    citationIndex,
  };
}

function appendProjectSection(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  project: Project
) {
  lines.push('## Project');
  lines.push(`Project name: ${project.name}`);

  addTextField(lines, citationIndex, {
    id: 'PROJECT:description',
    label: '프로젝트 설명',
    value: project.description,
    entityType: 'project',
    entityId: project.id,
  });
  addTextField(lines, citationIndex, {
    id: 'PROJECT:brief',
    label: '프로젝트 브리프',
    value: project.brief,
    entityType: 'project',
    entityId: project.id,
  });
  addTextField(lines, citationIndex, {
    id: 'PROJECT:constraints',
    label: '제약 조건',
    value: project.constraints,
    entityType: 'project',
    entityId: project.id,
  });
  addTextField(lines, citationIndex, {
    id: 'PROJECT:targetAudience',
    label: '타깃 오디언스',
    value: project.targetAudience,
    entityType: 'project',
    entityId: project.id,
  });
  addTextField(lines, citationIndex, {
    id: 'PROJECT:brandTone',
    label: '브랜드 톤',
    value: project.brandTone,
    entityType: 'project',
    entityId: project.id,
  });
}

function appendDirectionSection(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  directions: Direction[]
) {
  lines.push('## Directions');

  if (directions.length === 0) {
    lines.push('- No active directions.');
    return;
  }

  for (const direction of directions) {
    lines.push(`### Direction ${direction.name}`);

    addTextField(lines, citationIndex, {
      id: `DIRECTION:${direction.id}:name`,
      label: `${direction.name} 이름`,
      value: direction.name,
      entityType: 'direction',
      entityId: direction.id,
    });
    addTextField(lines, citationIndex, {
      id: `DIRECTION:${direction.id}:thesis`,
      label: `${direction.name} 방향 가설`,
      value: direction.thesis,
      entityType: 'direction',
      entityId: direction.id,
    });
    addTextField(lines, citationIndex, {
      id: `DIRECTION:${direction.id}:fitCriteria`,
      label: `${direction.name} 적합 기준`,
      value: direction.fitCriteria,
      entityType: 'direction',
      entityId: direction.id,
    });
    addTextField(lines, citationIndex, {
      id: `DIRECTION:${direction.id}:antiGoal`,
      label: `${direction.name} 피해야 할 느낌`,
      value: direction.antiGoal,
      entityType: 'direction',
      entityId: direction.id,
    });
    addTextField(lines, citationIndex, {
      id: `DIRECTION:${direction.id}:referenceNotes`,
      label: `${direction.name} 참고 메모`,
      value: direction.referenceNotes,
      entityType: 'direction',
      entityId: direction.id,
    });
  }
}

function appendNodesSection(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  nodes: Node[],
  directionsById: Record<string, Direction>
) {
  lines.push('## Nodes');

  if (nodes.length === 0) {
    lines.push('- No active nodes.');
    return;
  }

  for (const node of nodes) {
    appendNodeSection(lines, citationIndex, node, directionsById, 'Node');
  }
}

function appendNodeSection(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  node: Node,
  directionsById: Record<string, Direction>,
  heading: string
) {
  const nodeLabel = getNodeSequenceLabel(node);
  const directionName = node.directionId
    ? directionsById[node.directionId]?.name ?? '브랜치 없음'
    : '브랜치 없음';

  lines.push(`## ${heading} ${nodeLabel}`);

  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:summary`,
    label: `${nodeLabel} 요약`,
    value: `유형 ${node.nodeType}, 상태 ${node.status}, 브랜치 ${directionName}`,
    entityType: 'node',
    entityId: node.id,
  });
  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:userIntent`,
    label: `${nodeLabel} 사용자 의도`,
    value: node.userIntent,
    entityType: 'node',
    entityId: node.id,
  });
  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:prompt`,
    label: `${nodeLabel} 프롬프트`,
    value: node.resolvedPrompt ?? node.prompt,
    entityType: 'node',
    entityId: node.id,
  });
  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:note`,
    label: `${nodeLabel} 메모`,
    value: node.note,
    entityType: 'node',
    entityId: node.id,
  });
  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:intentTags`,
    label: `${nodeLabel} 의도 태그`,
    value: node.intentTags.join(', '),
    entityType: 'node',
    entityId: node.id,
  });
  addTextField(lines, citationIndex, {
    id: `NODE:${node.id}:changeTags`,
    label: `${nodeLabel} 변경 태그`,
    value: node.changeTags.join(', '),
    entityType: 'node',
    entityId: node.id,
  });
}

function addTextField(
  lines: string[],
  citationIndex: Record<string, CopilotCitation>,
  field: {
    id: string;
    label: string;
    value: string | null;
    entityType: CopilotCitation['entityType'];
    entityId: string;
  }
) {
  const value = normalizeValue(field.value);

  if (!value) {
    return;
  }

  citationIndex[field.id] = {
    id: field.id,
    label: field.label,
    entityType: field.entityType,
    entityId: field.entityId,
  };

  lines.push(`- [${field.id}] ${field.label}: ${value}`);
}

function normalizeValue(value: string | null) {
  if (!value) {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
}
