import Replicate from 'replicate';

const REPLICATE_AUTH_ERROR_PATTERN =
  /401|Unauthenticated|authentication token|valid authentication token/i;

export function createReplicateClient() {
  const auth = process.env.REPLICATE_API_TOKEN?.trim();

  if (!auth) {
    throw new Error(
      'REPLICATE_API_TOKEN is not configured on the server.'
    );
  }

  return new Replicate({ auth });
}

export function getReplicateErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? '').trim();

  if (!message) {
    return 'Failed to generate images with Replicate.';
  }

  if (REPLICATE_AUTH_ERROR_PATTERN.test(message)) {
    return 'Replicate authentication failed. Check the server REPLICATE_API_TOKEN value.';
  }

  return message;
}
