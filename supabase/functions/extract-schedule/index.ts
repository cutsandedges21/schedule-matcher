// supabase/functions/extract-schedule/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extractScheduleWithKeys } from './gemini.ts';

const EXTRACTIONS_PER_HOUR = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Must match the client's Zod caps (src/domain/schema.ts) so a single over-long
// field can't cause the client to discard the whole extracted array.
const NAME_MAX = 120;
const INSTRUCTOR_MAX = 120;
const ROOM_MAX = 60;

// Mirrors the SDK's canonical header list (node_modules/@supabase/supabase-js/dist/cors.mjs).
// supabase.functions.invoke() always sends apikey and x-client-info in addition to
// authorization/content-type; omitting any of these fails the CORS preflight and
// silently blocks every browser call. Keep this byte-identical to the SDK's list.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function normalizeClass(raw: Record<string, unknown>, warnings: string[]) {
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, NAME_MAX) : '';
  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))]
    : [];
  const startMinute = Number(raw.startMinute);
  const endMinute = Number(raw.endMinute);

  if (!name) { warnings.push('Skipped a class with no readable name.'); return null; }
  if (days.length === 0) { warnings.push(`Skipped "${name}": no readable meeting days.`); return null; }
  if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute) || endMinute <= startMinute) {
    warnings.push(`Skipped "${name}": times could not be read.`);
    return null;
  }
  if (startMinute < 0 || endMinute > 1440) {
    warnings.push(`Skipped "${name}": times outside a valid day.`);
    return null;
  }

  return {
    name,
    instructor:
      typeof raw.instructor === 'string' && raw.instructor.trim()
        ? raw.instructor.trim().slice(0, INSTRUCTOR_MAX)
        : null,
    room: typeof raw.room === 'string' && raw.room.trim() ? raw.room.trim().slice(0, ROOM_MAX) : null,
    days: days.sort((a, b) => a - b),
    startMinute,
    endMinute,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'UNAUTHORIZED' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'UNAUTHORIZED' }, 401);
  const userId = userData.user.id;

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'BAD_REQUEST' }, 400);
  }

  const { imageBase64, mimeType } = body;
  if (!imageBase64 || !mimeType?.startsWith('image/')) {
    return json({ error: 'BAD_IMAGE' }, 400);
  }
  if (imageBase64.length * 0.75 > MAX_IMAGE_BYTES) {
    return json({ error: 'IMAGE_TOO_LARGE' }, 413);
  }

  // Rate limit: protects a shared free-tier key from one user's daily quota burn.
  // log_extraction() checks-and-inserts atomically (advisory xact lock) so concurrent
  // requests can't all observe the same under-limit count (TOCTOU). Any error here
  // must fail closed — never let the request through unmetered.
  const { data: allowed, error: logError } = await admin.rpc('log_extraction', {
    p_user_id: userId,
    p_limit: EXTRACTIONS_PER_HOUR,
  });

  if (logError) {
    console.error('log_extraction RPC failed:', logError.message);
    return json({ error: 'RATE_LIMIT_CHECK_FAILED' }, 500);
  }
  if (!allowed) {
    return json({ error: 'RATE_LIMITED', retryAfterMinutes: 60 }, 429);
  }

  try {
    // GEMINI_API_KEYS is a comma-separated pool; GEMINI_API_KEY is accepted as a
    // single-key fallback so either secret name works.
    const keys = (Deno.env.get('GEMINI_API_KEYS') ?? Deno.env.get('GEMINI_API_KEY') ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const raw = await extractScheduleWithKeys({ base64: imageBase64, mimeType }, keys);
    const warnings = [...raw.warnings];
    const classes = raw.classes
      .map((c) => normalizeClass(c as Record<string, unknown>, warnings))
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return json({ classes, warnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PROVIDER_ERROR';
    // Never log the API key, the URL containing it, or the image data — only the
    // error message/status derived in gemini.ts.
    console.error('extract-schedule failed:', message);
    if (message === 'PROVIDER_RATE_LIMITED') {
      return json({ error: 'PROVIDER_RATE_LIMITED', retryAfterMinutes: 5 }, 429);
    }
    return json({ error: 'EXTRACTION_FAILED' }, 502);
  }
});
