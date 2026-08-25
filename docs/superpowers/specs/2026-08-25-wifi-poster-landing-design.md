# The fake-wifi poster landing page (`/wifi`)

## What

A public route at `https://schedulematcher.app/wifi` — the destination for a QR code printed
on promotional posters that are deliberately disguised as free-wifi notices. The page opens by
admitting the trick, pitches the app in about six lines, and sends the reader to `/login`.

This is a promotional add. Nothing in the app depends on it, and no existing behaviour changes.

## Why a dedicated route

Pointing the QR at `/` today would drop a cold scanner on a Google sign-in wall with no
explanation, because `/` is wrapped in `RequireAuth` (`src/App.tsx`). Someone who scanned a
poster expecting wifi and got an OAuth prompt bounces immediately. The page exists to spend
those first eight seconds explaining what happened and what the app is.

## Placement in the route table

Registered next to `/privacy` and `/terms` in `src/App.tsx` — **outside** `AuthProvider`, in
the bucket the existing comment there describes as readable before you have an account. The
page reads no auth state at all (see "No auth state" below), so it has no reason to sit inside
the provider.

```tsx
<Route path="/wifi" element={<WifiPage />} />
```

Imported **eagerly**, unlike the lazily-imported legal pages beside it. This is the first paint
for every poster scan, on campus 4G, and a lazy chunk adds a network round trip at exactly the
moment it costs the most. The component is static JSX with no images, so the cost to the main
bundle is negligible.

React Router v6 ranks by specificity rather than declaration order, so `/wifi` wins over the
`/*` catch-all regardless of position; it is placed beside the legal routes for readability,
not for correctness.

## No auth state

The page does not import `useAuth`, has no loading state, and performs no async work. It is
pure static JSX.

This falls out of routing the call to action to `/login` rather than calling
`signInWithOAuth` directly:

- **A signed-in visitor is already handled.** `src/features/auth/LoginPage.tsx` redirects any
  visitor who already has a session straight to their schedule. A student who has the app and
  scans a poster out of curiosity lands where they should, with no code here.
- **The OAuth call stays in one place.** An earlier draft of this design extracted the
  `signInWithOAuth` call — including the `prompt: 'select_account'` fix and the comment
  explaining it — into a shared module so two pages could call it. Routing to `/login` removes
  the need. `LoginPage.tsx` is not modified by this work.
- **Nothing can block the punchline.** With no session read and no spinner, the joke paints on
  first frame even while the network is still busy.

The cost is one extra tap versus an inline OAuth button. That is accepted and handled in the
copy: the button reads `ok, show me →`, not a fake "Continue with Google". A page whose entire
premise is *I tricked you and I am now being straight with you* cannot have a button that
misrepresents what tapping it does.

## Onboarding is reached with no new code

Requirement: the install instructions and the four intro slides must play after login no matter
which page the student entered from. **This already holds**, and was verified by tracing the
code rather than assumed:

1. `/wifi` → `/login`.
2. `LoginPage` signs in with `redirectTo` = origin + `peekRedirect()`. Nothing was stashed by
   the wifi page, and `rememberRedirect` in `src/features/auth/redirect.ts` explicitly refuses
   to store `/`, so this resolves to `/`.
3. `/` is wrapped in `RequireAuth`. Session yes, profile no, so
   `src/features/auth/RequireAuth.tsx` navigates to `/onboarding`.
4. `src/features/auth/OnboardingPage.tsx` runs its `install → intro → username` sequence,
   where the `intro` step renders `AboutIntro` — all four beats.

The gate is "this account has no `profiles` row", not "the student came from a particular
page", which is why an invite link, a typed URL and a poster scan all converge on the same
onboarding. No change is required to preserve this, and the test file guards the route so a
future change cannot quietly bypass it.

**Returning users who already have a profile do not replay the intro.** This is deliberate and
unchanged: the intro runs 20 seconds with no skip control by design (see the warning on
`SEQUENCE_DURATION` in `src/domain/slideshow.ts`), and replaying it on every sign-in would be
punishing.

## Copy

The voice is sincere and self-deprecating, lowercase, first-person singular — matching the
founder story in `src/domain/slideshow.ts`, which is also first-person singular because one
person built this.

```
        there is no wifi.

           i lied.

  in my defence: a poster that said
  "check out my app" would not have
  worked on you. this did.

  ────────────────────────────────

  you screenshot your class schedule.
  it reads it for you.

  then you and your friends can see
  every hour you're all free at the
  same time.

  no more sending screenshots to the
  group chat and doing the math
  yourself.

  ────────────────────────────────

     [   ok, show me  →   ]

  built by a Vanier student. free,
  no ads, nothing to buy.
  privacy · terms

  close it if you want. i'm just
  trying to help people out.
```

Four copy decisions worth recording, because each replaced a draft that failed for a specific
reason:

- **The trick is framed as a correct marketing decision, not as desperation.** An earlier
  opening read "this was the only way i could think of to get anyone to look at something i
  made". On a campus that reads as begging for attention, which invites contempt rather than
  curiosity. "in my defence: a poster that said 'check out my app' would not have worked on
  you. this did." says the same thing as a small flex, and makes the reader complicit in the
  joke instead of the victim of it.
- **No emoji.** The opening carried a 🫠 melting-face, which is a cringing-in-embarrassment
  signal — the same needy tone the copy was rewritten to remove. Nothing replaces it; the
  absence reads as more assured than any emoji would.
- **"Vanier student" sits on the trust line, not the apology line.** Next to an apology it
  functions as an excuse. Next to "free, no ads, nothing to buy" it functions as a credential.
- **No claim is made about data.** The page says "nothing to buy" and links to the privacy
  policy; it does not say anything to the effect of "your data never leaves your phone". The
  app does store schedules in Supabase and does send screenshot content to Gemini, and an
  overclaim on a page whose opening line is an admitted lie is the one thing that could
  legitimately destroy the reader's trust.

`privacy` and `terms` link to the existing `/privacy` and `/terms` routes.

## Files

| File | Change |
|---|---|
| `src/features/marketing/WifiPage.tsx` | New. The page. |
| `src/features/marketing/__tests__/WifiPage.test.tsx` | New. See below. |
| `src/App.tsx` | One route added beside `/privacy` and `/terms`, one eager import. |

A new `marketing/` feature folder rather than filing this under `auth/`: a campaign landing
page is not authentication, and the folder is where any future campaign page belongs.

## Implementation notes

- The call to action is a react-router `<Link>` styled with `buttonClassName('primary')` from
  `src/components/Button.tsx`, not a `<Button>`. The comment on `buttonClassName` documents
  this exact case — an `<a>` may not contain interactive content, so nesting a real `<button>`
  inside a `<Link>` is invalid HTML that breaks keyboard and screen-reader semantics.
- Layout follows `LoginPage.tsx`: `flex min-h-dvh flex-col` with `p-6`, content centred, action
  pinned at the bottom, `text-balance` on the wrapped prose.
- Colours use the default slate accent from `:root` in `src/index.css`. A cold scanner has no
  profile and therefore no school theme, so `SchoolThemeEffect` has not run — which is fine,
  because that block exists precisely so `/login` and the legal pages render correctly outside
  the authenticated tree.
- Real heading hierarchy: `there is no wifi.` is the `<h1>`. The existing `min-h-touch` target
  applies to the call to action via `buttonClassName`.
- No new dependencies.

## Tests

`src/features/marketing/__tests__/WifiPage.test.tsx`, using the vitest + testing-library setup
already in the repo:

- The reveal text renders on first paint, with no auth provider and no router state mocked
  beyond a `MemoryRouter`. This is the regression guard for "the joke never waits on the
  network" — a future change that makes the page depend on session state will fail here.
- The call to action links to `/login`.
- The privacy and terms links point at `/privacy` and `/terms`.

## Out of scope

- **Poster artwork.** The operator is designing and printing the posters.
- **Scan analytics.** No per-poster tracking parameter. If more than a handful of locations get
  posted, `/wifi?p=<location>` plus a counter would answer which locations convert, but it is
  not being built now.
- **Any change to `LoginPage`, `RequireAuth`, `OnboardingPage` or `AboutIntro`.**

## Printing note (not a code concern)

The QR encodes `https://schedulematcher.app/wifi` — short enough to keep the module count low
and stay readable from several feet away. The poster should not carry Vanier's name or logo,
or any real ISP's branding, and the landing page deliberately has no network-name or password
field: a joke poster is one thing, but anything that renders as credential capture is treated
very differently by a campus IT department.
