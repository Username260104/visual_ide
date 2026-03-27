interface NodeContentState {
  imageUrl: string;
  prompt: string | null;
  userIntent: string | null;
  resolvedPrompt: string | null;
}

interface NodeContentPatch {
  imageUrl?: string;
  prompt?: string | null;
  userIntent?: string | null;
  resolvedPrompt?: string | null;
}

export function getNodeContentState(node: NodeContentState): NodeContentState {
  return {
    imageUrl: node.imageUrl,
    prompt: node.prompt,
    userIntent: node.userIntent,
    resolvedPrompt: node.resolvedPrompt,
  };
}

export function getPatchedNodeContentState(
  currentNode: NodeContentState,
  patch: NodeContentPatch
): NodeContentState {
  return {
    imageUrl:
      patch.imageUrl !== undefined ? patch.imageUrl : currentNode.imageUrl,
    prompt:
      patch.prompt !== undefined || patch.resolvedPrompt !== undefined
        ? patch.resolvedPrompt ?? patch.prompt ?? null
        : currentNode.prompt,
    userIntent:
      patch.userIntent !== undefined ? patch.userIntent : currentNode.userIntent,
    resolvedPrompt:
      patch.resolvedPrompt !== undefined
        ? patch.resolvedPrompt
        : currentNode.resolvedPrompt,
  };
}

export function hasNodeContentChange(
  currentNode: NodeContentState,
  nextNode: NodeContentState
) {
  return (
    currentNode.imageUrl !== nextNode.imageUrl ||
    currentNode.prompt !== nextNode.prompt ||
    currentNode.userIntent !== nextNode.userIntent ||
    currentNode.resolvedPrompt !== nextNode.resolvedPrompt
  );
}
