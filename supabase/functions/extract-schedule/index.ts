// supabase/functions/extract-schedule/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extractSchedule } from './gemini.ts';

const EXTRACTIONS_PER_HOUR = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function normalizeClass(raw: Record<string, unknown>, warnings: string[]) {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
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
    instructor: typeof raw.instructor === 'string' && raw.instructor.trim() ? raw.instructor.trim() : null,
    room: typeof raw.room === 'string' && raw.room.trim() ? raw.room.trim() : null,
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

  // Rate limit: protects a shared free-tier key from one user's daily quota burn.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('extraction_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);

  if ((count ?? 0) >= EXTRACTIONS_PER_HOUR) {
    return json({ error: 'RATE_LIMITED', retryAfterMinutes: 60 }, 429);
  }

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

  await admin.from('extraction_log').insert({ user_id: userId });

  try {
    const raw = await extractSchedule({ base64: imageBase64, mimeType }, Deno.env.get('GEMINI_API_KEY')!);
    const warnings = [...raw.warnings];
    const classes = raw.classes
      .map((c) => normalizeClass(c as Record<string, unknown>, warnings))
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return json({ classes, warnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PROVIDER_ERROR';
    if (message === 'PROVIDER_RATE_LIMITED') {
      return json({ error: 'PROVIDER_RATE_LIMITED', retryAfterMinutes: 5 }, 429);
    }
    return json({ error: 'EXTRACTION_FAILED' }, 502);
  }
});
