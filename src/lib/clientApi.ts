export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  const payload = await readJsonBody(response);

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload, response),
      response.status,
      payload
    );
  }

  return payload as T;
}

export function indexById<T extends { id: string }>(
  items: T[]
): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown, response: Response): string {
  if (typeof payload === 'object' && payload !== null) {
    const error = Reflect.get(payload, 'error');
    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    const message = Reflect.get(payload, 'message');
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  return `Request failed with status ${response.status}`;
}
