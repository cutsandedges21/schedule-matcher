# Handoff prompt — client error monitoring

Paste everything below the line into a fresh Claude Code session opened in
`schedule-matcher/`.

---

## Task

Make client-side errors visible to the operators. Right now `ErrorBoundary`
catches render errors and shows a recovery page, but `componentDidCatch` only
calls `console.error` — so a student hits a white-screen-turned-error-page, the
operators never find out, and nobody reports it. This app is about to launch to
students who will silently uninstall rather than email anyone.

## Decide this first, and tell me your recommendation before building

**Where do errors go: a third-party service (Sentry et al.), or a Supabase
table we own?**

I lean strongly toward **the Supabase table**, for three reasons — but say so
if you disagree:

1. **Law 25.** This app stores schedules and a friend graph for Quebec
   students, some of them minors. Shipping error payloads (which routinely
   carry URLs, ids, and fragments of state) to a third-party processor outside
   Quebec is a disclosure that needs its own assessment. Keeping it in the
   database we already use avoids adding a processor entirely.
2. **Cost.** Everything here is free-tier on purpose. No new vendor, no
   surprise bill, no seat.
3. **The pattern already exists.** `supabase/migrations/0009_app_events.sql`
   and `src/lib/analytics.ts` are exactly this shape: insert-only, no select
   policy, fire-and-forget, read by the operators through the Management API.
   Reuse it rather than inventing a second way to do the same thing.

## Work

### 1. Migration `supabase/migrations/0010_client_errors.sql`

Read `0009_app_events.sql` first — it is the template, including the habit of
explaining *why* in a header comment.

```sql
create table public.client_errors (
  id          uuid primary key default gen_random_uuid(),
  -- auth.users, nullable: errors during onboarding happen before a profiles
  -- row exists, and an error on a signed-out screen has no user at all. A
  -- crash we cannot attribute is still a crash we need to see.
  user_id     uuid references auth.users(id) on delete cascade,
  message     text not null,
  stack       text,
  route       text,
  -- 'render' | 'window' | 'unhandledrejection'
  source      text not null check (source in ('render', 'window', 'unhandledrejection')),
  created_at  timestamptz not null default now()
);
```

Plus: an index on `(created_at desc)`, RLS enabled, an insert policy
(`with check (user_id = auth.uid() or user_id is null)`), and **deliberately no
select policy** — same reasoning as `app_events`.

**Cap the text columns.** A megabyte stack trace from a loop will happily fill
the free tier. Truncate client-side *and* add a length check constraint.

### 2. `src/lib/errorLog.ts`

Mirror `src/lib/analytics.ts` exactly. Its header states two rules that apply
here verbatim, and both are load-bearing:

- **Never chain `.select()`.** There is no select policy, so asking for the row
  back turns every write into a silent 401.
- **Reporting must never break the app.** Swallow all errors; warn only when
  `import.meta.env.DEV`. An error reporter that throws inside an error handler
  is an infinite loop.

**Three things this file must get right, and they are the whole job:**

1. **Rate limit hard.** A render error inside a re-render loop can fire
   thousands of times a second. Cap it — something like 5 reports per page
   session — and drop the rest silently. Get this wrong and one broken student
   fills the database.
2. **Deduplicate.** Hash `message + first stack frame` and report each distinct
   error once per session. The same error 400 times is one fact.
3. **Scrub.** Never log schedule contents, class names, usernames, emails, or
   the full URL with a query string. `/compare?with=alice,bob` leaks a friend
   graph into an error table that was specifically designed not to hold one.
   Log the **route pattern** (`/compare`), not the resolved URL.

### 3. Wire up three sources

- `ErrorBoundary.componentDidCatch` → `source: 'render'`. Keep the existing
  `console.error`.
- `window.addEventListener('error', …)` → `source: 'window'`.
- `window.addEventListener('unhandledrejection', …)` → source likewise. This
  one matters most in practice: every failed `await` in this codebase surfaces
  here.

Register the two listeners in `src/main.tsx`, next to the `installPrompt`
side-effect import, so they are live before React mounts.

### 4. A read query

Add `supabase/analytics/errors.sql` following `phase0.sql`: one statement,
returning the last 7 days grouped by message with a count and a
`distinct user_id` count — "how many students did this hit" is the number that
decides whether to care.

## Known traps

1. **Sourcemaps.** Production stack traces are minified and near-useless.
   Check `vite.config.ts` — if `build.sourcemap` is off, stacks will be
   `a1b2c3.js:1:4821`. Turning it on publishes your source, which for this app
   is fine (it is a client-side PWA with no secrets in the bundle; all secrets
   live in Edge Function env). Recommend a setting and explain the tradeoff.
2. `SUPABASE_ACCESS_TOKEN` is unavailable and neither the MCP nor the CLI can
   reach project `sjsywoptzbugfiqisdhh`. **Do not try to apply the migration** —
   hand me the SQL to paste into the dashboard editor.
3. Do not chain `.select()` onto the insert. Stated twice on purpose.
4. `StrictMode` double-invokes renders in development, so a render error can
   report twice locally. Make sure the dedupe handles it rather than papering
   over it.

Run `npm test` and `npm run build` before telling me it is done, and give me
the migration SQL as a paste block.
