# Schedule Matcher

Upload a screenshot of your class schedule, correct anything the reader misses,
and share a real weekly schedule with friends.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase URL and anon key
npm run dev
```

## Supabase

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase secrets set GEMINI_API_KEY=<key>
npx supabase functions deploy extract-schedule
```

Enable the Google auth provider in the Supabase dashboard and add both
`http://localhost:5173/` and the production URL to the redirect list.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Domain unit tests |
| `npm run build` | Type check and production build |

## Docs

- Design: `docs/superpowers/specs/2026-08-16-schedule-matcher-design.md`
- Plan: `docs/superpowers/plans/2026-08-16-schedule-matcher.md`
