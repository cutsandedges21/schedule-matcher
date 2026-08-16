// supabase/functions/extract-schedule/gemini.ts
import { SYSTEM_PROMPT, RESPONSE_SCHEMA } from './prompt.ts';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface RawExtraction {
  classes: unknown[];
  warnings: string[];
}

/**
 * The single seam where the vision provider is chosen. Swapping providers
 * means writing another module with this signature and changing one import.
 */
export async function extractSchedule(
  image: { base64: string; mimeType: string },
  apiKey: string
): Promise<RawExtraction> {
  const response = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Extract every class from this schedule.' },
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (response.status === 429) throw new Error('PROVIDER_RATE_LIMITED');
  if (!response.ok) throw new Error(`PROVIDER_ERROR_${response.status}`);

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') throw new Error('PROVIDER_EMPTY_RESPONSE');

  const parsed = JSON.parse(text);
  return {
    classes: Array.isArray(parsed.classes) ? parsed.classes : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };
}
