import { GoogleGenAI } from '@google/genai';

const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const DEFAULT_GEMINI_API_VERSION = 'v1';

let geminiClient: GoogleGenAI | null = null;
let geminiClientKey: string | null = null;
let geminiClientVersion: string | null = null;

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || null;

  if (!apiKey) {
    return null;
  }

  const apiVersion =
    process.env.GEMINI_API_VERSION?.trim() || DEFAULT_GEMINI_API_VERSION;

  if (
    geminiClient &&
    geminiClientKey === apiKey &&
    geminiClientVersion === apiVersion
  ) {
    return geminiClient;
  }

  geminiClient = new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { httpOptions: { apiVersion } } : {}),
  });
  geminiClientKey = apiKey;
  geminiClientVersion = apiVersion;

  return geminiClient;
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export async function generateGeminiJson<T>({
  systemInstruction,
  prompt,
  responseJsonSchema,
}: {
  systemInstruction: string;
  prompt: string;
  responseJsonSchema: unknown;
}) {
  const client = getGeminiClient();

  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const response = await client.models.generateContent({
    model: getGeminiModel(),
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseJsonSchema,
    },
  });

  const text = response.text?.trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Gemini returned an invalid JSON response.');
  }
}
