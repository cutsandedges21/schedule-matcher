// supabase/functions/delete-account/index.ts
//
// Deleting an account means deleting the auth.users row, and only the service
// role can do that — the browser's publishable key cannot, at any RLS setting.
// Hence an Edge Function: it re-derives the caller's id from their own JWT and
// deletes exactly that user, never an id supplied in the request body.
//
// Everything else follows by cascade, so there is nothing to clean up by hand:
//   auth.users -> profiles -> classes, friendships (both sides)
//   auth.users -> extraction_log
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Mirrors the SDK's canonical header list, byte for byte. supabase.functions
// .invoke() always sends apikey and x-client-info alongside authorization and
// content-type; omitting any of them fails the CORS preflight and silently
// blocks every browser call. Keep this identical to extract-schedule's copy.
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

  // The id comes from the verified token, never from the request body. A body
  // parameter here would be a trivial "delete any account you can name" hole.
  const userId = userData.user.id;

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    // Never echo the raw message back to the browser — it can carry internal
    // schema detail. Log it server-side and return a flat code.
    console.error('delete-account failed:', deleteError.message);
    return json({ error: 'DELETE_FAILED' }, 500);
  }

  return json({ ok: true });
});
