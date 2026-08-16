// supabase/functions/extract-schedule/gemini.ts
import { SYSTEM_PROMPT, RESPONSE_SCHEMA } from './prompt.ts';

/**
 * Tried in order. Google retires models for NEW API keys while still listing
 * them from /v1beta/models, so a hardcoded single model silently 404s with
 * "no longer available to new users" — which is exactly how extraction broke
 * on gemini-2.5-flash. Keeping a list means a retirement degrades instead of
 * taking the feature down.
 */
const MODELS = ['gemini-3-flash-preview', 'gemini-flash-latest'];

const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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
  let lastError: Error = new Error('PROVIDER_ERROR');

  for (const model of MODELS) {
    try {
      return await callModel(image, apiKey, model);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('PROVIDER_ERROR');
      // A rate limit is about the KEY, not the model — let the caller rotate keys
      // rather than pointlessly retrying every model on an exhausted quota.
      if (lastError.message === 'PROVIDER_RATE_LIMITED') throw lastError;
      console.error(`Gemini model ${model} failed: ${lastError.message}`);
    }
  }

  throw lastError;
}

async function callModel(
  image: { base64: string; mimeType: string },
  apiKey: string,
  model: string
): Promise<RawExtraction> {
  // Key travels as a header, not a URL query param: Deno's fetch includes the full
  // request URL in TypeError messages on transient network failures, which would
  // otherwise leak the key into an Error.message. See Google's documented form:
  // https://ai.google.dev/gemini-api/docs/api-key#use-request-header
  const response = await fetch(endpointFor(model), {
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
