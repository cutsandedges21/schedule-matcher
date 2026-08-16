import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Vite inlines VITE_* vars at BUILD time, so a deploy whose build environment
 * lacks them produces a bundle with `undefined` baked in — the values cannot be
 * supplied later at runtime.
 *
 * This used to `throw` here at module scope. That kills the whole app before
 * React mounts and renders a blank white page with nothing but a console entry,
 * which is a miserable way to discover a missing environment variable. Instead
 * we report the problem and let main.tsx render something a human can act on.
 */
export const configError =
  !url || !anonKey
    ? 'This deployment is missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. ' +
      'They must be set in the build environment (Vercel: Project Settings → Environment ' +
      'Variables) and the project redeployed, because Vite bakes them into the bundle at ' +
      'build time. Locally, copy .env.local.example to .env.local.'
    : null;

/**
 * Placeholders keep createClient from throwing when config is missing. They are
 * never exercised: main.tsx renders the configuration error instead of the app,
 * so nothing ever issues a request through this client.
 */
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
