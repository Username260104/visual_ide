import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

interface VariationPromptOptions {
  parentPrompt?: string | null;
  intentTags?: string[];
  changeTags?: string[];
  note?: string;
}

export async function improveImagePrompt(prompt: string): Promise<string> {
  const normalizedPrompt = normalizePrompt(prompt);
  const anthropic = getAnthropicClient();

  if (!anthropic) {
    return buildPromptFallback(normalizedPrompt);
  }

  try {
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `You are an expert AI image prompt engineer. Improve the following image generation prompt to be more detailed and effective. Add specific details about style, lighting, mood, composition, and technical quality while preserving the user's original intent.

Original prompt: "${normalizedPrompt}"

Requirements:
- Keep the core concept intact
- Add vivid descriptive details (lighting, color palette, atmosphere, camera angle, art style)
- Make it 1-3 sentences max
- Output ONLY the improved prompt text, nothing else`,
        },
      ],
    });

    const improvedPrompt = getTextContent(message.content);
    return improvedPrompt || buildPromptFallback(normalizedPrompt);
  } catch (error) {
    console.warn('Prompt improvement fallback:', error);
    return buildPromptFallback(normalizedPrompt);
  }
}

export async function buildVariationPrompt({
  parentPrompt,
  intentTags = [],
  changeTags = [],
  note,
}: VariationPromptOptions): Promise<string> {
  const basePrompt = normalizePrompt(
    parentPrompt || 'Create a refined variation of the source image.'
  );
  const anthropic = getAnthropicClient();

  if (!anthropic) {
    return buildVariationPromptFallback({
      parentPrompt: basePrompt,
      intentTags,
      changeTags,
      note,
    });
  }

  const intentStr = intentTags.length > 0 ? `Intent: ${intentTags.join(', ')}` : '';
  const changeStr =
    changeTags.length > 0 ? `Changes to apply: ${changeTags.join(', ')}` : '';
  const noteStr = note ? `Additional note: ${note}` : '';

  try {
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `You are an expert AI image prompt engineer. Given an original image prompt and the desired modifications, create a new prompt for a variation of the original image.

Original prompt: "${basePrompt}"
${intentStr}
${changeStr}
${noteStr}

Requirements:
- Preserve the core elements of the original prompt
- Apply the specified changes/intentions naturally
- Keep the prompt detailed and descriptive (1-3 sentences)
- Output ONLY the new prompt text, nothing else`,
        },
      ],
    });

    const variationPrompt = getTextContent(message.content);
    return (
      variationPrompt ||
      buildVariationPromptFallback({
        parentPrompt: basePrompt,
        intentTags,
        changeTags,
        note,
      })
    );
  } catch (error) {
    console.warn('Variation prompt fallback:', error);
    return buildVariationPromptFallback({
      parentPrompt: basePrompt,
      intentTags,
      changeTags,
      note,
    });
  }
}

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new Anthropic({ apiKey });
}

function getTextContent(
  content: Array<{ type: string; text?: string }>
): string {
  return content
    .filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function buildPromptFallback(prompt: string) {
  return `${prompt} Detailed composition, intentional lighting, cohesive color palette, polished textures, and strong visual clarity.`;
}

function buildVariationPromptFallback({
  parentPrompt,
  intentTags,
  changeTags,
  note,
}: {
  parentPrompt: string;
  intentTags: string[];
  changeTags: string[];
  note?: string;
}) {
  const modifiers = [
    intentTags.length > 0 ? `Focus on ${intentTags.join(', ')}.` : null,
    changeTags.length > 0 ? `Adjust ${changeTags.join(', ')}.` : null,
    note ? `Additional guidance: ${normalizePrompt(note)}.` : null,
    'Preserve the main subject and overall visual identity while making the changes feel natural and production-ready.',
  ]
    .filter(Boolean)
    .join(' ');

  return `${parentPrompt} ${modifiers}`.trim();
}

function normalizePrompt(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}
