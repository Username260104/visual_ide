import { Prisma } from '@/generated/prisma/client';

const NODE_ORDINAL_RETRY_LIMIT = 3;

export async function getNextProjectNodeOrdinal(
  tx: Prisma.TransactionClient,
  projectId: string
) {
  const ordinalAggregate = await tx.node.aggregate({
    where: {
      projectId,
    },
    _max: {
      nodeOrdinal: true,
    },
  });

  return (ordinalAggregate._max.nodeOrdinal ?? 0) + 1;
}

export async function withNodeOrdinalRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = NODE_ORDINAL_RETRY_LIMIT
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isNodeOrdinalConflict(error) || attempt >= maxAttempts) {
        throw error;
      }
    }
  }

  throw lastError;
}

function isNodeOrdinalConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== 'P2002') {
    return false;
  }

  const metaText = JSON.stringify(error.meta ?? {});
  return (
    metaText.includes('node_ordinal') ||
    metaText.includes('nodes_project_id_node_ordinal_key') ||
    metaText.includes('project_id')
  );
}
