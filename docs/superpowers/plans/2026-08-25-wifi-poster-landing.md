# Fake-Wifi Poster Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/wifi` route — the landing page for a QR code on posters disguised as free-wifi notices — that admits the trick, pitches the app in six lines, and links to `/login`.

**Architecture:** One static React component with zero auth dependencies, registered outside `AuthProvider` alongside `/privacy` and `/terms`. The call to action is a react-router `<Link>` to `/login`, not an inline `signInWithOAuth` call, which is what keeps the page free of session reads, loading states and async work — so the punchline paints on the first frame. Existing sign-in and onboarding code is not modified: a new account with no `profiles` row is already routed through `install → intro → username` by `RequireAuth`.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind, react-router-dom, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-25-wifi-poster-landing-design.md`

---

## Repo conventions you must follow

Read these before writing a line — they are not the defaults you are used to.

1. **There is no `@testing-library/jest-dom` in this repo.** Matchers like `toBeInTheDocument()` do not exist and will throw. Assert with `expect(x).toBeDefined()`, `expect(x).toBeNull()`, and `expect(el.getAttribute('href')).toBe('/path')`. Check `src/components/__tests__/ErrorPage.test.tsx` if unsure.
2. **Vitest's default environment is `node`** (see the `test` block in `vite.config.ts`). Every DOM test must open with the pragma comment `// @vitest-environment jsdom` on line 1.
3. **Test files open with two comments**: the pragma, then the file's own path. Then `afterEach(cleanup);` before the `describe`.
4. **Test glob** is `src/**/__tests__/**/*.test.{ts,tsx}`. A file at `src/features/marketing/__tests__/WifiPage.test.tsx` is picked up automatically; no config change.
5. **`@` is aliased to `./src`** in `vite.config.ts`. Use `@/components/Button`, not relative paths — except inside a `__tests__` folder importing its own sibling, where the existing files use `../WifiPage`.
6. **Never nest a `<button>` inside a `<Link>`.** Use `buttonClassName()` from `src/components/Button.tsx` on the `<Link>` directly. The comment on that function explains why: an `<a>` may not contain interactive content.
7. This repo comments the *why* heavily. Match that density — a bare component with no header comment will look wrong next to its neighbours.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/features/marketing/WifiPage.tsx` | **Create.** The whole page. Static JSX, no state, no effects, no data fetching. Its only imports are `Link` and `buttonClassName`. |
| `src/features/marketing/__tests__/WifiPage.test.tsx` | **Create.** Guards the reveal text, the auth-free render, and the three link targets. |
| `src/App.tsx` | **Modify.** One eager import, one `<Route>`, and an extension to the existing comment above `<Routes>`. |

A new `marketing/` feature folder: a campaign landing page is not authentication, and this is where any future campaign page goes.

---

### Task 1: The WifiPage component

**Files:**
- Create: `src/features/marketing/WifiPage.tsx`
- Test: `src/features/marketing/__tests__/WifiPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/marketing/__tests__/WifiPage.test.tsx`:

```tsx
// @vitest-environment jsdom
// src/features/marketing/__tests__/WifiPage.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WifiPage from '../WifiPage';

afterEach(cleanup);

/**
 * MemoryRouter is the *only* context provided, deliberately. There is no
 * AuthProvider and no Supabase mock here, so if someone later makes this page
 * read session state, every test in this file throws. That is the regression
 * this file exists to catch: a cold poster scan has to paint the punchline on
 * the first frame, which it cannot do if it is waiting on a session.
 */
function renderPage() {
  render(
    <MemoryRouter initialEntries={['/wifi']}>
      <WifiPage />
    </MemoryRouter>
  );
}

describe('WifiPage', () => {
  it('admits the trick in the h1, with no auth context available', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('there is no wifi.');
    expect(screen.getByText('i lied.')).toBeDefined();
  });

  it('explains what the app does before asking for anything', () => {
    renderPage();

    expect(screen.getByText(/you screenshot your class schedule/i)).toBeDefined();
    expect(screen.getByText(/free at the same time/i)).toBeDefined();
  });

  it('sends the reader to /login rather than signing in inline', () => {
    renderPage();

    const cta = screen.getByRole('link', { name: /ok, show me/i });
    expect(cta.getAttribute('href')).toBe('/login');
  });

  it('links to the privacy policy and the terms', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'privacy' }).getAttribute('href')).toBe('/privacy');
    expect(screen.getByRole('link', { name: 'terms' }).getAttribute('href')).toBe('/terms');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/features/marketing/__tests__/WifiPage.test.tsx
```

Expected: FAIL. The error is a module resolution failure, something like
`Failed to resolve import "../WifiPage"`, because the component does not exist yet.

- [ ] **Step 3: Write the component**

Create `src/features/marketing/WifiPage.tsx`:

```tsx
// src/features/marketing/WifiPage.tsx
import { Link } from 'react-router-dom';
import { buttonClassName } from '@/components/Button';

/**
 * The landing page for a QR code printed on posters disguised as free-wifi
 * notices. Whoever scanned it wanted a network and got this, so the first
 * line has to admit that before anything else is allowed to happen.
 *
 * Deliberately auth-free. The call to action is a link to /login rather than
 * a signInWithOAuth call, which means no session read, no loading state and
 * no async work anywhere on this page — so the punchline paints on the first
 * frame, which is the entire point on campus 4G. It costs one extra tap, and
 * that is why the button says "ok, show me" instead of impersonating the
 * Google button on the next screen: a page that opens by admitting a lie
 * cannot afford a button that misrepresents what tapping it does. LoginPage
 * already redirects a visitor who turns out to be signed in, so the "they
 * already have the app" case needs nothing here either.
 *
 * The copy decisions are recorded in
 * docs/superpowers/specs/2026-08-25-wifi-poster-landing-design.md. Two that
 * matter if you edit this: the trick is framed as a marketing decision rather
 * than as desperation (an earlier draft read as begging for attention), and
 * nothing is claimed about data handling — schedules go to Supabase and
 * screenshots go to Gemini, so the privacy link carries that weight instead.
 */
export default function WifiPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-between gap-8 p-6">
      <div className="flex flex-1 flex-col justify-center gap-6 text-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-bold tracking-tight">there is no wifi.</h1>
          <p className="text-2xl font-bold tracking-tight text-slate-400">i lied.</p>
        </div>

        <p className="mx-auto max-w-xs text-balance text-sm leading-relaxed text-slate-600">
          in my defence: a poster that said &ldquo;check out my app&rdquo; would not have worked
          on you. this did.
        </p>

        <hr className="mx-auto w-16 border-slate-200" />

        <div className="mx-auto flex max-w-xs flex-col gap-3 text-balance leading-relaxed text-slate-900">
          <p>you screenshot your class schedule. it reads it for you.</p>
          <p>then you and your friends can see every hour you&rsquo;re all free at the same time.</p>
          <p className="text-slate-600">
            no more sending screenshots to the group chat and doing the math yourself.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link to="/login" className={buttonClassName('primary', 'w-full')}>
          ok, show me &rarr;
        </Link>

        <p className="text-center text-xs leading-relaxed text-slate-500">
          built by a Vanier student. free, no ads, nothing to buy.
          <br />
          <Link to="/privacy" className="underline underline-offset-2">
            privacy
          </Link>
          {' · '}
          <Link to="/terms" className="underline underline-offset-2">
            terms
          </Link>
        </p>

        <p className="text-center text-xs leading-relaxed text-slate-400">
          close it if you want. i&rsquo;m just trying to help people out.
        </p>
      </div>
    </main>
  );
}
```

Note the argument order on `buttonClassName(variant, className, size)` — the class string is the
**second** argument, not the first.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/features/marketing/__tests__/WifiPage.test.tsx
```

Expected: PASS, 4 tests.

If `getByRole('link', { name: 'privacy' })` fails on an ambiguous name, the cause is that the
accessible name picked up surrounding text; the fix is to keep the two legal links as their own
elements exactly as written above, not to loosen the assertion to a regex.

- [ ] **Step 5: Commit**

```bash
git add src/features/marketing/WifiPage.tsx src/features/marketing/__tests__/WifiPage.test.tsx
git commit -m "feat(marketing): the fake-wifi poster landing page

Static, auth-free page for the QR code on posters disguised as free-wifi
notices. The CTA links to /login rather than calling signInWithOAuth, which
is what keeps the page free of session reads and loading states so the
punchline paints on the first frame.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Wire the route

**Files:**
- Modify: `src/App.tsx` (the eager import block near the top, and the `<Routes>` inside `App`)

- [ ] **Step 1: Add the eager import**

In `src/App.tsx`, find this line among the top-level eager imports:

```tsx
import NotFoundPage from '@/features/error/NotFoundPage';
```

Add directly beneath it:

```tsx
import WifiPage from '@/features/marketing/WifiPage';
```

**Eager, not lazy** — unlike the `lazy(() => import(...))` block just below it. This page is the
first paint for every poster scan, and a lazy chunk adds a network round trip at exactly the
moment it costs the most. The component is static JSX with no images, so it barely moves the
main bundle.

- [ ] **Step 2: Add the route and extend the comment**

In the `App` component at the bottom of the file, replace this:

```tsx
  // The legal pages are deliberately outside AuthProvider: a privacy policy
  // or a set of terms has to be readable before you have an account, or it
  // isn't much use to anyone. `/*` covers every other route.
```

with this:

```tsx
  // The legal pages are deliberately outside AuthProvider: a privacy policy
  // or a set of terms has to be readable before you have an account, or it
  // isn't much use to anyone. /wifi — the poster landing page — sits in the
  // same bucket for the same reason, and reads no session state at all.
  // `/*` covers every other route.
```

Then, in the same `<Routes>` block, add the route immediately above `/privacy`:

```tsx
          <Route path="/wifi" element={<WifiPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
```

React Router v6 ranks routes by specificity rather than declaration order, so `/wifi` beats the
`/*` catch-all wherever it sits. It goes here for readability, next to the other public routes.

- [ ] **Step 3: Typecheck**

```bash
npx tsc -b
```

Expected: no output, exit code 0. Any error here is an import path typo.

- [ ] **Step 4: Verify the route in a browser**

```bash
npm run dev
```

Open `http://localhost:5173/wifi` and confirm, at a 375px-wide viewport (phone size — this is a
mobile-first app and every scanner is on a phone):

- "there is no wifi." and "i lied." are both visible without scrolling.
- Nothing flashes, spins, or appears after a delay. The page is complete on the first frame.
- Tapping **ok, show me →** goes to `/login` and shows "Continue with Google".
- The **privacy** and **terms** links open the real legal pages.
- The page does not scroll horizontally.

Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(marketing): route /wifi outside AuthProvider

Eagerly imported rather than lazy like its neighbours: this is the first
paint for every poster scan, and a lazy chunk costs a round trip exactly
where it hurts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Full verification

No new code in this task. It exists because the previous two ran narrow commands, and a
regression elsewhere would not have shown up.

- [ ] **Step 1: Run the whole test suite**

```bash
npx vitest run
```

Expected: every test passes. The suite was at 250+ tests before this work; the count should go
up by 4 and nothing should go red. If something unrelated fails, stop and report it rather than
pressing on — do not fix it as part of this branch.

- [ ] **Step 2: Run a production build**

```bash
npm run build
```

Expected: exit code 0. This runs `tsc -b` and then `vite build`, so it catches type errors the
dev server tolerates.

- [ ] **Step 3: Confirm onboarding is still reached from the new entry point**

This is a **read-only code check**, not a code change — the spec's claim is that no change is
needed, and this step confirms the chain is still intact after the route was added. Verify each
link by reading the file:

1. `src/features/marketing/WifiPage.tsx` — the CTA points at `/login`.
2. `src/features/auth/LoginPage.tsx` — `signInWithOAuth` uses `redirectTo` built from
   `peekRedirect()`.
3. `src/features/auth/redirect.ts` — `rememberRedirect` refuses to store `/`, so `peekRedirect()`
   returns `/` for a visitor who arrived via `/wifi`.
4. `src/features/auth/RequireAuth.tsx` — `if (!profile && location.pathname !== '/onboarding')`
   navigates to `/onboarding`.
5. `src/features/auth/OnboardingPage.tsx` — the `step` state runs `install → intro → username`,
   and the `intro` step renders `AboutIntro`.

If any link in that chain has changed, stop and report it — a new student arriving from a poster
would be skipping the install instructions and the intro slides, which is the one requirement
this feature must not break.

- [ ] **Step 4: Report, do not self-certify**

State the actual command output for steps 1 and 2 (test count, build exit status). Do not claim
the feature works without pasting what the commands printed.

---

## Out of scope — do not build these

- **Poster artwork.** The operator designs and prints the posters.
- **Scan analytics.** No `?p=<location>` tracking parameter, no counter.
- **Any modification to `LoginPage.tsx`, `RequireAuth.tsx`, `OnboardingPage.tsx`, `AboutIntro.tsx`, `redirect.ts`, or `slideshow.ts`.** An earlier draft of the design extracted the shared OAuth call into a new module; routing to `/login` removed the need, and reintroducing it is not in scope.
- **A "seen the intro" flag.** Returning users with a profile are supposed to skip the slides.

## Note for whoever generates the QR code

Encode `https://schedulematcher.app/wifi`. Keep Vanier's name and logo, and any real ISP's
branding, off the poster, and do not add a network-name or password field to the page — a joke
poster is one thing, but anything that reads as credential capture is treated very differently
by a campus IT department.
