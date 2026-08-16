// Replays the extract-schedule Gemini call locally against a real screenshot,
// so extraction can be debugged without deploying or signing in.
//
//   GEMINI_API_KEY=... node scripts/test-gemini.mjs <image-path>

import { readFileSync } from 'node:fs';

const imagePath = process.argv[2];
const apiKey = process.env.GEMINI_API_KEY;
if (!imagePath || !apiKey) {
  console.error('usage: GEMINI_API_KEY=... node scripts/test-gemini.mjs <image-path>');
  process.exit(2);
}

// Keep these in sync with supabase/functions/extract-schedule/prompt.ts
const { SYSTEM_PROMPT, RESPONSE_SCHEMA } = await import('../supabase/functions/extract-schedule/prompt.ts')
  .catch(async () => {
    // prompt.ts is Deno-flavoured TS; fall back to parsing it out.
    const src = readFileSync('supabase/functions/extract-schedule/prompt.ts', 'utf8');
    const promptMatch = src.match(/SYSTEM_PROMPT = `([\s\S]*?)`;/);
    const schemaMatch = src.match(/RESPONSE_SCHEMA = ([\s\S]*?);\n/);
    return {
      SYSTEM_PROMPT: promptMatch[1],
      RESPONSE_SCHEMA: eval('(' + schemaMatch[1] + ')'),
    };
  });

const base64 = readFileSync(imagePath).toString('base64');
const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

console.log(`image: ${imagePath} (${Math.round(base64.length * 0.75 / 1024)} KB)`);

const started = Date.now();
const model = process.env.MODEL ?? 'gemini-flash-latest';
console.log(`model: ${model}`);
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Extract every class from this schedule.' },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  }
);

console.log(`status: ${response.status} (${Date.now() - started}ms)`);
const payload = await response.json();

if (!response.ok) {
  console.error('ERROR BODY:', JSON.stringify(payload, null, 2).slice(0, 2000));
  process.exit(1);
}

const candidate = payload.candidates?.[0];
console.log('finishReason:', candidate?.finishReason);
console.log('usage:', JSON.stringify(payload.usageMetadata));

const text = candidate?.content?.parts?.[0]?.text;
if (typeof text !== 'string') {
  console.error('NO TEXT PART. Full candidate:\n', JSON.stringify(candidate, null, 2).slice(0, 2000));
  process.exit(1);
}

console.log('\n--- parsed ---');
console.log(JSON.stringify(JSON.parse(text), null, 2));
