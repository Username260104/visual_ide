export interface TreeNodeLike {
  id: string;
  parentNodeId: string | null;
}

export function collectDescendantIds(
  nodes: Iterable<TreeNodeLike>,
  rootId: string
) {
  const nodeList = Array.from(nodes);
  const childrenByParent = new Map<string, string[]>();

  for (const node of nodeList) {
    if (!node.parentNodeId) {
      continue;
    }

    const siblings = childrenByParent.get(node.parentNodeId) ?? [];
    siblings.push(node.id);
    childrenByParent.set(node.parentNodeId, siblings);
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(rootId) ?? [])];

  while (queue.length > 0) {
    const nextId = queue.shift();
    if (!nextId || descendants.has(nextId)) {
      continue;
    }

    descendants.add(nextId);
    queue.push(...(childrenByParent.get(nextId) ?? []));
  }

  return descendants;
}

export function wouldCreateNodeCycle(
  nodes: Iterable<TreeNodeLike>,
  nodeId: string,
  nextParentId: string | null
) {
  if (!nextParentId) {
    return false;
  }

  if (nextParentId === nodeId) {
    return true;
  }

  return collectDescendantIds(Array.from(nodes), nodeId).has(nextParentId);
}
