// supabase/functions/extract-schedule/gemini.ts
import { SYSTEM_PROMPT, RESPONSE_SCHEMA } from './prompt.ts';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface RawExtraction {
  classes: unknown[];
  warnings: string[];
}

/**
 * Tries each key in turn, moving on only when one is out of free-tier quota.
 *
 * Gemini's free tier is metered per key, and uploads bunch hard at the start of
 * a term (design spec §4.2) — pooling keys multiplies the daily ceiling without
 * any other machinery. Rotation happens ONLY on 429; a genuine error (bad
 * request, malformed image) fails immediately rather than burning every key on
 * a request that was never going to succeed.
 *
 * If every key is exhausted the caller still gets PROVIDER_RATE_LIMITED, so the
 * student lands in manual entry as before.
 */
export async function extractScheduleWithKeys(
  image: { base64: string; mimeType: string },
  apiKeys: string[]
): Promise<RawExtraction> {
  if (apiKeys.length === 0) throw new Error('PROVIDER_NO_KEYS');

  for (let i = 0; i < apiKeys.length; i += 1) {
    try {
      return await extractSchedule(image, apiKeys[i]);
    } catch (error) {
      const isLastKey = i === apiKeys.length - 1;
      const message = error instanceof Error ? error.message : '';
      if (message !== 'PROVIDER_RATE_LIMITED' || isLastKey) throw error;
      console.error(`Gemini key ${i + 1}/${apiKeys.length} rate limited, trying next`);
    }
  }

  throw new Error('PROVIDER_RATE_LIMITED');
}

/**
 * The single seam where the vision provider is chosen. Swapping providers
 * means writing another module with this signature and changing one import.
 */
export async function extractSchedule(
  image: { base64: string; mimeType: string },
  apiKey: string
): Promise<RawExtraction> {
  // Key travels as a header, not a URL query param: Deno's fetch includes the full
  // request URL in TypeError messages on transient network failures, which would
  // otherwise leak the key into an Error.message. See Google's documented form:
  // https://ai.google.dev/gemini-api/docs/api-key#use-request-header
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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
