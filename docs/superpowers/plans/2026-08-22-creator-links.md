# Creator Links on Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "More from me" section to the Settings page linking out to LifeOS, Summit Sites, and Cuts & Edges, and extend the shared row component so it can carry an external link and a one-line description.

**Architecture:** `NavRow` currently lives as a private helper inside `SettingsPage.tsx` and only supports in-app navigation (`to`, via react-router `Link`). Pull it into its own file (`src/components/NavRow.tsx`, alongside the app's other small shared UI primitives like `Button.tsx`) so it's unit-testable in isolation from `SettingsPage`'s auth context, and extend it with an `href` mode (external, new tab) and an optional `description` line. `SettingsPage.tsx` then imports it and gains one new section.

**Tech Stack:** React 19, TypeScript, Tailwind, Vitest + @testing-library/react, react-router-dom (`MemoryRouter` for the test's internal-link case).

Spec: `docs/superpowers/specs/2026-08-22-creator-links-design.md`

---

### Task 1: Extract and extend `NavRow`

**Files:**
- Create: `src/components/NavRow.tsx`
- Create: `src/components/__tests__/NavRow.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/NavRow.test.tsx`:

```tsx
// @vitest-environment jsdom
// src/components/__tests__/NavRow.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavRow from '../NavRow';

afterEach(cleanup);

describe('NavRow', () => {
  it('renders an internal row as an in-app link with the chevron glyph', () => {
    render(
      <MemoryRouter>
        <NavRow to="/privacy" label="Privacy Policy" />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: /Privacy Policy/ });
    expect(link.getAttribute('href')).toBe('/privacy');
    expect(link.getAttribute('target')).toBeNull();
    expect(screen.getByText('›')).toBeDefined();
  });

  it('renders an external row as a new-tab link with a description and the leaving-app glyph', () => {
    render(<NavRow href="https://example.com" label="Example" description="An example site" />);

    const link = screen.getByRole('link', { name: /Example/ });
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText('An example site')).toBeDefined();
    expect(screen.getByText('↗')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/__tests__/NavRow.test.tsx`
Expected: FAIL — `Cannot find module '../NavRow'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/components/NavRow.tsx`:

```tsx
// src/components/NavRow.tsx
import { Link } from 'react-router-dom';

/**
 * One row in a grouped list: a label, a trailing glyph, and a whole-row tap
 * target. `to` navigates within the app; `href` is for an external site and
 * always opens in a new tab — `rel="noopener noreferrer"` is not optional
 * there, since without it the opened tab could reach back into
 * `window.opener`. The glyph tells the difference before a tap: `›` for
 * in-app, `↗` for leaving it. Exactly one of `to`/`href` must be given.
 */
export default function NavRow({
  to,
  href,
  label,
  description,
}: {
  to?: string;
  href?: string;
  label: string;
  description?: string;
}) {
  const className =
    'flex min-h-touch items-center justify-between gap-3 px-4 py-3 text-left active:bg-slate-100';

  const content = (
    <>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-slate-500">{description}</span>}
      </span>
      <span aria-hidden className="shrink-0 text-slate-400">
        {href ? '↗' : '›'}
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  if (!to) throw new Error('NavRow requires either `to` or `href`.');

  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/NavRow.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/NavRow.tsx src/components/__tests__/NavRow.test.tsx
git commit -m "feat(schedule-matcher): extract NavRow with external-link support"
```

---

### Task 2: Wire `NavRow` into `SettingsPage` and add the "More from me" section

**Files:**
- Modify: `src/features/auth/SettingsPage.tsx`

- [ ] **Step 1: Remove the local `NavRow` definition and its now-unused `Link` import**

In `src/features/auth/SettingsPage.tsx`, delete these lines (the local helper being replaced):

```tsx
import { Link } from 'react-router-dom';
```

```tsx
/** One row in a grouped list: a label, a chevron, and a whole-row tap target. */
function NavRow({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-touch items-center justify-between px-4 py-3 text-sm font-medium active:bg-slate-100"
    >
      {label}
      <span aria-hidden className="text-slate-400">
        ›
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Import the extracted `NavRow`**

Add to the top of `src/features/auth/SettingsPage.tsx`, alongside the other `@/` imports:

```tsx
import NavRow from '@/components/NavRow';
```

- [ ] **Step 3: Add the "More from me" section**

In `src/features/auth/SettingsPage.tsx`, insert this new `<section>` immediately after the closing `</section>` of the "Legal" section and before the `<Button variant="secondary" onClick={() => void signOut()} ...>Sign out</Button>` line:

```tsx
      <section>
        <h2 className="text-sm font-bold text-slate-900">More from me</h2>
        <p className="mt-1 text-xs text-slate-500">
          I also run a few other things outside of class:
        </p>
        <ul className="mt-2 overflow-hidden rounded-2xl border-2 border-accent bg-white">
          <li>
            <NavRow
              href="https://lifeos-daily.vercel.app"
              label="LifeOS"
              description="Track your goals, health, and money in one place"
            />
          </li>
          <li className="border-t border-slate-200">
            <NavRow
              href="https://summit-sites.vercel.app"
              label="Summit Sites"
              description="Web design for businesses across Canada"
            />
          </li>
          <li className="border-t border-slate-200">
            <NavRow
              href="https://cutsandedges.vercel.app"
              label="Cuts & Edges"
              description="Lawn care in RDP, Anjou & Saint-Léonard"
            />
          </li>
        </ul>
      </section>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all test files, including the 2 new `NavRow` tests (252 tests total, up from 250).

- [ ] **Step 6: Production build**

Run: `npm run build`
Expected: builds cleanly; `SettingsPage` chunk size grows slightly (new section + import), no new chunk-size warning beyond the pre-existing `index` chunk one.

- [ ] **Step 7: Manual browser check**

Run: `npm run dev`, sign in (or use an existing authenticated session), navigate to `/settings`, and confirm:
- A "More from me" section appears between "Legal" and "Sign out", with a bold black heading and a 2px accent-colored border on its card — visibly more prominent than the plain-bordered "Legal" card above it.
- Each of the three rows shows its name and one-line description, and a `↗` glyph (not `›`).
- Tapping each row opens the correct URL in a new browser tab, and the Settings page itself stays open in the original tab.
- The existing "Legal" and "Appearance" rows still work exactly as before (single line, `›` glyph, in-app navigation, no new tab).

- [ ] **Step 8: Commit**

```bash
git add src/features/auth/SettingsPage.tsx
git commit -m "feat(schedule-matcher): add More from me section to Settings"
```

---

## Self-Review

- **Spec coverage:** placement (between Legal and Sign out) ✓ Task 2 Step 3. Heading/intro copy ✓ same step. Visibility styling (bold heading, accent border) ✓ same step. Three rows with names/URLs/descriptions ✓ same step. External-link behavior (`target`, `rel`, `↗` glyph) ✓ Task 1. `NavRow` prop extension, non-breaking for existing `to`-only callers ✓ Task 1 Step 3 (both params stay optional; Legal/Appearance call sites in Task 2 Step 1 aren't touched beyond the import). Out-of-scope items (icons, analytics, i18n) — correctly not implemented anywhere in this plan.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code.
- **Type consistency:** `NavRow`'s prop names (`to`, `href`, `label`, `description`) are identical between its definition (Task 1 Step 3), its tests (Task 1 Step 1), and its call sites (Task 2 Step 3).
