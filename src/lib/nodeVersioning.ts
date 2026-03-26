import type { NodeData } from './types';

type NodeSequenceLike = Pick<NodeData, 'nodeOrdinal' | 'versionNumber'>;

export function getNodeSequenceNumber(node: NodeSequenceLike) {
  return node.nodeOrdinal ?? node.versionNumber;
}

export function getNodeSequenceLabel(node: NodeSequenceLike) {
  return `v${getNodeSequenceNumber(node)}`;
}
