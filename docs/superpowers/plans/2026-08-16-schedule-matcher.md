# Schedule Matcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first web app where students upload a class-schedule screenshot, an LLM extracts it into structured JSON they can correct, and the confirmed result renders as a weekly grid they can share with friends and overlay against a friend's schedule.

**Architecture:** Vite + React 19 SPA talking directly to Supabase (Google auth, Postgres with RLS). The only server-side code is one Supabase Edge Function that holds the Gemini key and turns an image into validated JSON — it never writes to the database, so extraction and persistence stay separate. All schedule maths (time parsing, grid layout, overlap, mutual free time) lives in pure functions under `src/domain/` with no React or DOM dependency, which is where nearly all the tests are.

**Tech Stack:** Vite 5, React 19, TypeScript, Tailwind CSS 3, react-router-dom 7, @supabase/supabase-js 2, Zod 4, Vitest, Supabase Edge Functions (Deno), Google Gemini Flash, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-16-schedule-matcher-design.md`

**Shippable milestone:** After Task 13 the app is usable end-to-end for a single student (sign in → upload → correct → see grid). Tasks 14–19 add the social layer.

---

## File Structure

```
schedule-matcher/
  index.html                          viewport meta, root div
  package.json                        scripts + deps
  vite.config.ts                      Vite + Vitest config
  tailwind.config.js                  breakpoints, safe-area plugin-free utilities
  vercel.json                         SPA rewrite
  .env.local.example                  documents required env vars
  supabase/
    migrations/0001_schema.sql        tables, constraints, indexes
    migrations/0002_rls.sql           are_friends() + all policies
    functions/extract-schedule/
      index.ts                        HTTP handler: auth, rate limit, orchestrate
      gemini.ts                       VisionProvider implementation
      prompt.ts                       system prompt + Gemini responseSchema
  src/
    main.tsx                          React root, router
    index.css                         Tailwind directives, safe-area vars
    lib/supabase.ts                   browser client singleton
    domain/
      constants.ts                    DAY_START_MINUTE, WEEKDAYS, CLASS_PALETTE
      text.ts                         normalizeClassName
      time.ts                         parseTimeToMinutes, formatMinutes, formatHourLabel
      color.ts                        colorForClass, CLASS_COLORS
      types.ts                        ClassMeeting, ExtractedClass, Interval
      schema.ts                       Zod schemas shared with the Edge Function
      layout.ts                       computeAxis, computeLayout
      compare.ts                      findSharedClasses, computeMutualFree
      image.ts                        downscaleImage (browser only, untested)
      mappers.ts                      rowToMeeting, meetingToInsert
      __tests__/                      one test file per domain module
    components/
      AppShell.tsx                    layout + bottom nav slot
      BottomNav.tsx                   mobile tab bar, safe-area aware
      Button.tsx, Spinner.tsx, EmptyState.tsx
    features/
      auth/AuthProvider.tsx           session context
      auth/RequireAuth.tsx            route guard + onboarding redirect
      auth/LoginPage.tsx
      auth/OnboardingPage.tsx         username picker
      schedule/useSchedule.ts         load/save classes
      schedule/SchedulePage.tsx
      schedule/ScheduleGrid.tsx       shared grid renderer
      schedule/DaySelector.tsx        mobile day chips
      schedule/ClassBlock.tsx
      upload/UploadPage.tsx           orchestrates picker → extract → review
      upload/ImagePicker.tsx          library + camera inputs
      upload/ReviewForm.tsx           card list + save
      upload/ClassCard.tsx            one editable class
      friends/useFriends.ts
      friends/FriendsPage.tsx
      friends/FriendSearch.tsx
      friends/PendingRequests.tsx
      friends/InvitePage.tsx
      friends/FriendSchedulePage.tsx
      compare/ComparePage.tsx
      compare/CompareGrid.tsx
      compare/CompareSummary.tsx
```

**Why this split:** `src/domain/` is pure and framework-free, so it can be tested with plain Vitest in a node environment and reasoned about without React in the way. Features are grouped by user-facing capability rather than technical layer, so everything that changes together lives together.

---

# Phase 1 — Scaffold

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`, `.env.local.example`, `vercel.json`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "schedule-matcher",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.105.4",
    "clsx": "^2.1.1",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.15.0",
    "tailwind-merge": "^3.5.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^24.12.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.27",
    "postcss": "^8.5.8",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.6.0",
    "vite": "^5.4.19",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`**

Vitest config lives here rather than a separate file. `environment: 'node'` because every test targets pure domain logic — no DOM needed.

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Create the TypeScript configs**

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `index.html`**

`viewport-fit=cover` is required for `env(safe-area-inset-*)` to return non-zero values on iPhone. Pinch zoom is deliberately left enabled.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0f172a" />
    <title>Schedule Matcher</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `tailwind.config.js` and `postcss.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
    },
  },
  plugins: [],
};
```

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 6: Create `src/index.css`**

The `input` rule prevents iOS Safari from auto-zooming when a field is focused, which is the single most common mobile-web papercut.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    -webkit-text-size-adjust: 100%;
  }
  body {
    @apply bg-slate-50 text-slate-900 antialiased;
    overscroll-behavior-y: none;
  }
  input,
  select,
  textarea {
    font-size: 16px;
  }
}
```

- [ ] **Step 7: Create `src/main.tsx` and `src/App.tsx` placeholders**

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

```tsx
// src/App.tsx
export default function App() {
  return <div className="p-4">Schedule Matcher</div>;
}
```

- [ ] **Step 8: Create `.gitignore`, `.env.local.example`, `vercel.json`**

```
# .gitignore
node_modules
dist
.env.local
.env
*.local
.DS_Store
supabase/.temp
```

```
# .env.local.example
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 9: Install and verify the app boots**

Run: `npm install && npm run build`
Expected: build succeeds, `dist/` produced, no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + react + tailwind project"
```

---

# Phase 2 — Domain logic (pure, TDD)

This phase has no UI and no network. Every function here is deterministic and fully tested. Build it first because the grid, the compare view, and the extraction validator all depend on it.

### Task 2: Constants and types

**Files:**
- Create: `src/domain/constants.ts`, `src/domain/types.ts`

- [ ] **Step 1: Create `src/domain/constants.ts`**

```ts
/** Fixed schedule grid window: 08:00–18:00, expressed as minutes from midnight. */
export const DAY_START_MINUTE = 480;
export const DAY_END_MINUTE = 1080;

/** Shortest gap that counts as usable mutual free time. */
export const MIN_FREE_MINUTES = 30;

/** ISO weekday numbers: 1 = Monday .. 7 = Sunday. */
export const WEEKDAYS = [1, 2, 3, 4, 5] as const;
export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun',
};

/** Single-letter labels for the mobile day-toggle chips. */
export const WEEKDAY_INITIALS: Record<number, string> = {
  1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S', 7: 'S',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1600;
export const EXTRACTIONS_PER_HOUR = 10;
```

- [ ] **Step 2: Create `src/domain/types.ts`**

```ts
/** One meeting block: a class at one time, repeating on one or more weekdays. */
export interface ClassMeeting {
  id: string;
  name: string;
  instructor: string | null;
  room: string | null;
  days: number[];
  startMinute: number;
  endMinute: number;
  color: string;
}

/** What the Edge Function returns — no id, no colour, not yet persisted. */
export interface ExtractedClass {
  name: string;
  instructor: string | null;
  room: string | null;
  days: number[];
  startMinute: number;
  endMinute: number;
}

export interface Interval {
  start: number;
  end: number;
}

export interface AxisRange {
  startMinute: number;
  endMinute: number;
}

export interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  inviteCode: string;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/domain
git commit -m "feat: add domain constants and core types"
```

---

### Task 3: Time parsing and formatting

**Files:**
- Create: `src/domain/time.ts`
- Test: `src/domain/__tests__/time.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/__tests__/time.test.ts
import { describe, it, expect } from 'vitest';
import { parseTimeToMinutes, formatMinutes, formatHourLabel } from '../time';

describe('parseTimeToMinutes', () => {
  it('parses 12-hour times with a meridiem', () => {
    expect(parseTimeToMinutes('10:00 AM')).toBe(600);
    expect(parseTimeToMinutes('10:00am')).toBe(600);
    expect(parseTimeToMinutes('1:15p')).toBe(795);
    expect(parseTimeToMinutes('9:05 PM')).toBe(1265);
    expect(parseTimeToMinutes('8 a.m.')).toBe(480);
  });

  it('handles the 12 o clock edge cases', () => {
    expect(parseTimeToMinutes('12:00 AM')).toBe(0);
    expect(parseTimeToMinutes('12:00 PM')).toBe(720);
    expect(parseTimeToMinutes('12:30 AM')).toBe(30);
  });

  it('parses 24-hour times', () => {
    expect(parseTimeToMinutes('13:00')).toBe(780);
    expect(parseTimeToMinutes('08:05')).toBe(485);
    expect(parseTimeToMinutes('00:00')).toBe(0);
  });

  it('returns null for input it cannot trust', () => {
    expect(parseTimeToMinutes('')).toBeNull();
    expect(parseTimeToMinutes('noon')).toBeNull();
    expect(parseTimeToMinutes('25:00')).toBeNull();
    expect(parseTimeToMinutes('10:75')).toBeNull();
    expect(parseTimeToMinutes('13:00 PM')).toBeNull();
    expect(parseTimeToMinutes('1300')).toBeNull();
  });
});

describe('formatMinutes', () => {
  it('renders 12-hour clock time', () => {
    expect(formatMinutes(600)).toBe('10:00 AM');
    expect(formatMinutes(795)).toBe('1:15 PM');
    expect(formatMinutes(0)).toBe('12:00 AM');
    expect(formatMinutes(720)).toBe('12:00 PM');
    expect(formatMinutes(1440)).toBe('12:00 AM');
  });
});

describe('formatHourLabel', () => {
  it('renders a compact axis label', () => {
    expect(formatHourLabel(480)).toBe('8 AM');
    expect(formatHourLabel(720)).toBe('12 PM');
    expect(formatHourLabel(1080)).toBe('6 PM');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/__tests__/time.test.ts`
Expected: FAIL — "Failed to resolve import '../time'".

- [ ] **Step 3: Write the implementation**

```ts
// src/domain/time.ts

/**
 * Accepts "10:00 AM", "10:00am", "1:15p", "8 a.m.", "13:00", "08:05".
 * Returns minutes from midnight, or null when the input cannot be trusted.
 * Returning null rather than guessing matters: a wrong time is worse than a
 * blank field the student can fill in.
 */
const TIME_PATTERN = /^(\d{1,2})(?::(\d{2}))?([ap])?\.?m?\.?$/;

export function parseTimeToMinutes(raw: string): number | null {
  const compact = raw.trim().toLowerCase().replace(/\s+/g, '');
  const match = TIME_PATTERN.exec(compact);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];

  if (minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'a') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
  } else if (hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

export function formatMinutes(total: number): string {
  const hour24 = Math.floor(total / 60) % 24;
  const minute = total % 60;
  const meridiem = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

export function formatHourLabel(total: number): string {
  const hour24 = Math.floor(total / 60) % 24;
  const meridiem = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12} ${meridiem}`;
}

/** For <input type="time">, which requires 24-hour "HH:MM". */
export function toTimeInputValue(total: number): string {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/__tests__/time.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/time.ts src/domain/__tests__/time.test.ts
git commit -m "feat: add time parsing and formatting"
```

---

### Task 4: Class-name normalization and colour assignment

**Files:**
- Create: `src/domain/text.ts`, `src/domain/color.ts`
- Test: `src/domain/__tests__/color.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/__tests__/color.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeClassName } from '../text';
import { colorForClass, CLASS_PALETTE, CLASS_COLORS } from '../color';

describe('normalizeClassName', () => {
  it('collapses case, punctuation and whitespace', () => {
    expect(normalizeClassName('BIO 101')).toBe('bio 101');
    expect(normalizeClassName('  bio-101  ')).toBe('bio 101');
    expect(normalizeClassName('BIO_101')).toBe('bio 101');
    expect(normalizeClassName('Bio  101')).toBe('bio 101');
  });
});

describe('colorForClass', () => {
  it('is deterministic', () => {
    expect(colorForClass('BIO 101')).toBe(colorForClass('BIO 101'));
  });

  it('gives names that normalize the same the same colour', () => {
    expect(colorForClass('BIO 101')).toBe(colorForClass('bio-101'));
  });

  it('only ever returns a palette key that has styles defined', () => {
    for (const name of ['BIO 101', 'MATH 220', 'ENG 105', 'CHEM 1A', 'PSY 300', '']) {
      const key = colorForClass(name);
      expect(CLASS_PALETTE).toContain(key);
      expect(CLASS_COLORS[key]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/__tests__/color.test.ts`
Expected: FAIL — cannot resolve `../text`.

- [ ] **Step 3: Write the implementation**

`normalizeClassName` lives in its own module because both `color.ts` and `compare.ts` need it; putting it in either would create an import cycle.

```ts
// src/domain/text.ts

/** Lowercases and collapses punctuation so "BIO-101" and "bio 101" compare equal. */
export function normalizeClassName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
```

Tailwind's scanner only sees class names that appear as complete literal strings in source, so `bg-${color}-100` would silently produce unstyled blocks. `CLASS_COLORS` maps palette keys to full literal class strings for that reason.

```ts
// src/domain/color.ts
import { normalizeClassName } from './text';

export const CLASS_PALETTE = [
  'indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'teal', 'orange',
] as const;

export type ClassColor = (typeof CLASS_PALETTE)[number];

export interface ClassColorStyles {
  block: string;
  text: string;
  accent: string;
}

/**
 * Full literal Tailwind classes — never build these by interpolation, the
 * JIT scanner cannot see interpolated names and the styles get dropped.
 */
export const CLASS_COLORS: Record<string, ClassColorStyles> = {
  indigo:  { block: 'bg-indigo-100 border-indigo-300',   text: 'text-indigo-900',  accent: 'bg-indigo-500' },
  emerald: { block: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-900', accent: 'bg-emerald-500' },
  amber:   { block: 'bg-amber-100 border-amber-300',     text: 'text-amber-900',   accent: 'bg-amber-500' },
  rose:    { block: 'bg-rose-100 border-rose-300',       text: 'text-rose-900',    accent: 'bg-rose-500' },
  sky:     { block: 'bg-sky-100 border-sky-300',         text: 'text-sky-900',     accent: 'bg-sky-500' },
  violet:  { block: 'bg-violet-100 border-violet-300',   text: 'text-violet-900',  accent: 'bg-violet-500' },
  teal:    { block: 'bg-teal-100 border-teal-300',       text: 'text-teal-900',    accent: 'bg-teal-500' },
  orange:  { block: 'bg-orange-100 border-orange-300',   text: 'text-orange-900',  accent: 'bg-orange-500' },
};

/**
 * Deterministic name → colour. Because it depends only on the name, the same
 * class gets the same colour for every student, which is what makes shared
 * classes visually obvious in the compare view with no coordination.
 */
export function colorForClass(name: string): ClassColor {
  const normalized = normalizeClassName(name);
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return CLASS_PALETTE[hash % CLASS_PALETTE.length];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/__tests__/color.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/text.ts src/domain/color.ts src/domain/__tests__/color.test.ts
git commit -m "feat: add class name normalization and deterministic colours"
```

---

### Task 5: Zod schemas

**Files:**
- Create: `src/domain/schema.ts`
- Test: `src/domain/__tests__/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/__tests__/schema.test.ts
import { describe, it, expect } from 'vitest';
import { extractedClassSchema, extractionResponseSchema, usernameSchema } from '../schema';

const valid = {
  name: 'BIO 101',
  instructor: 'Dr. Reyes',
  room: 'SCI 204',
  days: [1, 3, 5],
  startMinute: 600,
  endMinute: 650,
};

describe('extractedClassSchema', () => {
  it('accepts a well-formed class', () => {
    expect(extractedClassSchema.parse(valid)).toEqual(valid);
  });

  it('defaults missing optional fields to null', () => {
    const parsed = extractedClassSchema.parse({ ...valid, instructor: undefined, room: undefined });
    expect(parsed.instructor).toBeNull();
    expect(parsed.room).toBeNull();
  });

  it('rejects an end time at or before the start', () => {
    expect(() => extractedClassSchema.parse({ ...valid, endMinute: 600 })).toThrow();
    expect(() => extractedClassSchema.parse({ ...valid, endMinute: 599 })).toThrow();
  });

  it('rejects an empty name and empty days', () => {
    expect(() => extractedClassSchema.parse({ ...valid, name: '' })).toThrow();
    expect(() => extractedClassSchema.parse({ ...valid, days: [] })).toThrow();
  });

  it('rejects out-of-range weekdays and minutes', () => {
    expect(() => extractedClassSchema.parse({ ...valid, days: [0] })).toThrow();
    expect(() => extractedClassSchema.parse({ ...valid, days: [8] })).toThrow();
    expect(() => extractedClassSchema.parse({ ...valid, startMinute: -1 })).toThrow();
    expect(() => extractedClassSchema.parse({ ...valid, endMinute: 1441 })).toThrow();
  });
});

describe('extractionResponseSchema', () => {
  it('accepts an empty result', () => {
    expect(extractionResponseSchema.parse({ classes: [], warnings: [] })).toEqual({
      classes: [], warnings: [],
    });
  });

  it('defaults warnings to an empty array', () => {
    expect(extractionResponseSchema.parse({ classes: [] }).warnings).toEqual([]);
  });
});

describe('usernameSchema', () => {
  it('accepts lowercase handles', () => {
    expect(usernameSchema.parse('moss_b21')).toBe('moss_b21');
  });

  it('rejects handles that are too short, too long, or wrongly cased', () => {
    expect(() => usernameSchema.parse('ab')).toThrow();
    expect(() => usernameSchema.parse('a'.repeat(21))).toThrow();
    expect(() => usernameSchema.parse('MossB')).toThrow();
    expect(() => usernameSchema.parse('moss b')).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/__tests__/schema.test.ts`
Expected: FAIL — cannot resolve `../schema`.

- [ ] **Step 3: Write the implementation**

```ts
// src/domain/schema.ts
import { z } from 'zod';

export const usernameSchema = z
  .string()
  .min(3, 'At least 3 characters')
  .max(20, 'At most 20 characters')
  .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and underscores only');

export const extractedClassSchema = z
  .object({
    name: z.string().min(1).max(120),
    instructor: z.string().max(120).nullish().transform((v) => v ?? null),
    room: z.string().max(60).nullish().transform((v) => v ?? null),
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((c) => c.endMinute > c.startMinute, {
    message: 'End time must be after start time',
    path: ['endMinute'],
  });

export const extractionResponseSchema = z.object({
  classes: z.array(extractedClassSchema),
  warnings: z.array(z.string()).default([]),
});

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/__tests__/schema.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/schema.ts src/domain/__tests__/schema.test.ts
git commit -m "feat: add zod schemas for extraction and usernames"
```

---

### Task 6: Grid axis and layout

**Files:**
- Create: `src/domain/layout.ts`
- Test: `src/domain/__tests__/layout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/__tests__/layout.test.ts
import { describe, it, expect } from 'vitest';
import { computeAxis, computeLayout } from '../layout';
import { DAY_START_MINUTE, DAY_END_MINUTE } from '../constants';
import type { ClassMeeting } from '../types';

function meeting(over: Partial<ClassMeeting> = {}): ClassMeeting {
  return {
    id: over.id ?? 'c1',
    name: over.name ?? 'BIO 101',
    instructor: null,
    room: null,
    days: over.days ?? [1],
    startMinute: over.startMinute ?? 600,
    endMinute: over.endMinute ?? 650,
    color: 'indigo',
    ...over,
  };
}

describe('computeAxis', () => {
  it('uses the fixed 08:00-18:00 window when everything fits', () => {
    expect(computeAxis([meeting()])).toEqual({
      startMinute: DAY_START_MINUTE,
      endMinute: DAY_END_MINUTE,
    });
  });

  it('uses the fixed window for an empty schedule', () => {
    expect(computeAxis([])).toEqual({
      startMinute: DAY_START_MINUTE,
      endMinute: DAY_END_MINUTE,
    });
  });

  it('extends downward to the hour for an early class', () => {
    const axis = computeAxis([meeting({ startMinute: 435, endMinute: 500 })]);
    expect(axis.startMinute).toBe(420);
    expect(axis.endMinute).toBe(DAY_END_MINUTE);
  });

  it('extends upward to the hour for a night class', () => {
    const axis = computeAxis([meeting({ startMinute: 1140, endMinute: 1265 })]);
    expect(axis.startMinute).toBe(DAY_START_MINUTE);
    expect(axis.endMinute).toBe(1320);
  });

  it('extends in both directions across several classes', () => {
    const axis = computeAxis([
      meeting({ id: 'a', startMinute: 420, endMinute: 470 }),
      meeting({ id: 'b', startMinute: 1100, endMinute: 1200 }),
    ]);
    expect(axis).toEqual({ startMinute: 420, endMinute: 1200 });
  });
});

describe('computeLayout', () => {
  const axis = { startMinute: DAY_START_MINUTE, endMinute: DAY_END_MINUTE };

  it('places a block proportionally in the window', () => {
    const [block] = computeLayout([meeting({ startMinute: 480, endMinute: 540 })], [1], axis);
    expect(block.topPct).toBeCloseTo(0);
    expect(block.heightPct).toBeCloseTo(10);
  });

  it('emits one block per weekday the class meets', () => {
    const blocks = computeLayout([meeting({ days: [1, 3, 5] })], [1, 2, 3, 4, 5], axis);
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => b.day).sort()).toEqual([1, 3, 5]);
  });

  it('ignores classes that do not meet on the requested days', () => {
    expect(computeLayout([meeting({ days: [6] })], [1, 2, 3, 4, 5], axis)).toHaveLength(0);
  });

  it('gives non-overlapping blocks a single full-width lane', () => {
    const blocks = computeLayout(
      [
        meeting({ id: 'a', startMinute: 480, endMinute: 540 }),
        meeting({ id: 'b', startMinute: 540, endMinute: 600 }),
      ],
      [1],
      axis
    );
    expect(blocks.every((b) => b.laneCount === 1 && b.lane === 0)).toBe(true);
  });

  it('splits overlapping blocks into side-by-side lanes', () => {
    const blocks = computeLayout(
      [
        meeting({ id: 'a', startMinute: 480, endMinute: 600 }),
        meeting({ id: 'b', startMinute: 540, endMinute: 660 }),
      ],
      [1],
      axis
    );
    expect(blocks.every((b) => b.laneCount === 2)).toBe(true);
    expect(blocks.map((b) => b.lane).sort()).toEqual([0, 1]);
  });

  it('keeps a class outside the fixed window visible when the axis is extended', () => {
    const nightAxis = { startMinute: DAY_START_MINUTE, endMinute: 1320 };
    const [block] = computeLayout(
      [meeting({ startMinute: 1140, endMinute: 1260 })],
      [1],
      nightAxis
    );
    expect(block).toBeDefined();
    expect(block.topPct).toBeGreaterThan(0);
    expect(block.topPct + block.heightPct).toBeLessThanOrEqual(100.0001);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/__tests__/layout.test.ts`
Expected: FAIL — cannot resolve `../layout`.

- [ ] **Step 3: Write the implementation**

```ts
// src/domain/layout.ts
import { DAY_START_MINUTE, DAY_END_MINUTE } from './constants';
import type { AxisRange, ClassMeeting } from './types';

export interface PositionedBlock {
  meeting: ClassMeeting;
  day: number;
  topPct: number;
  heightPct: number;
  lane: number;
  laneCount: number;
}

/**
 * The axis is fixed at 08:00–18:00 so every schedule renders at one scale.
 * A class outside that window extends the axis outward to the nearest hour
 * rather than being clipped — silently hiding a night class would be data
 * loss the student cannot see.
 */
export function computeAxis(classes: ClassMeeting[]): AxisRange {
  let startMinute = DAY_START_MINUTE;
  let endMinute = DAY_END_MINUTE;

  for (const c of classes) {
    if (c.startMinute < startMinute) startMinute = Math.floor(c.startMinute / 60) * 60;
    if (c.endMinute > endMinute) endMinute = Math.ceil(c.endMinute / 60) * 60;
  }

  return { startMinute, endMinute };
}

/** Greedy lane assignment within each cluster of transitively-overlapping blocks. */
function assignLanes(
  items: ClassMeeting[]
): Array<{ meeting: ClassMeeting; lane: number; laneCount: number }> {
  const sorted = [...items].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute
  );

  const out: Array<{ meeting: ClassMeeting; lane: number; laneCount: number }> = [];
  let cluster: Array<{ meeting: ClassMeeting; lane: number }> = [];
  let laneEnds: number[] = [];
  let clusterMaxEnd = -Infinity;

  const flush = () => {
    const laneCount = laneEnds.length;
    for (const entry of cluster) out.push({ ...entry, laneCount });
    cluster = [];
    laneEnds = [];
    clusterMaxEnd = -Infinity;
  };

  for (const meeting of sorted) {
    if (cluster.length > 0 && meeting.startMinute >= clusterMaxEnd) flush();

    let lane = laneEnds.findIndex((end) => end <= meeting.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(meeting.endMinute);
    } else {
      laneEnds[lane] = meeting.endMinute;
    }

    cluster.push({ meeting, lane });
    clusterMaxEnd = Math.max(clusterMaxEnd, meeting.endMinute);
  }

  if (cluster.length > 0) flush();
  return out;
}

export function computeLayout(
  classes: ClassMeeting[],
  days: number[],
  axis: AxisRange
): PositionedBlock[] {
  const span = axis.endMinute - axis.startMinute;
  if (span <= 0) return [];

  const blocks: PositionedBlock[] = [];

  for (const day of days) {
    const onThisDay = classes.filter((c) => c.days.includes(day));
    for (const { meeting, lane, laneCount } of assignLanes(onThisDay)) {
      blocks.push({
        meeting,
        day,
        topPct: ((meeting.startMinute - axis.startMinute) / span) * 100,
        heightPct: ((meeting.endMinute - meeting.startMinute) / span) * 100,
        lane,
        laneCount,
      });
    }
  }

  return blocks;
}

/** Hour marks for the axis gutter, inclusive of both ends. */
export function axisHours(axis: AxisRange): number[] {
  const hours: number[] = [];
  for (let m = axis.startMinute; m <= axis.endMinute; m += 60) hours.push(m);
  return hours;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/__tests__/layout.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/layout.ts src/domain/__tests__/layout.test.ts
git commit -m "feat: add fixed-axis grid layout with overlap lanes"
```

---

### Task 7: Shared classes and mutual free time

**Files:**
- Create: `src/domain/compare.ts`
- Test: `src/domain/__tests__/compare.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/__tests__/compare.test.ts
import { describe, it, expect } from 'vitest';
import { findSharedClasses, computeMutualFree, isSameClass } from '../compare';
import { DAY_START_MINUTE, DAY_END_MINUTE } from '../constants';
import type { ClassMeeting } from '../types';

function meeting(over: Partial<ClassMeeting> = {}): ClassMeeting {
  return {
    id: 'c1', name: 'BIO 101', instructor: null, room: null,
    days: [1], startMinute: 600, endMinute: 650, color: 'indigo',
    ...over,
  };
}

describe('isSameClass', () => {
  it('matches on normalized name and overlapping time', () => {
    expect(isSameClass(meeting(), meeting({ id: 'x', name: 'bio-101' }))).toBe(true);
  });

  it('rejects the same name at a non-overlapping time', () => {
    expect(isSameClass(meeting(), meeting({ id: 'x', startMinute: 700, endMinute: 750 }))).toBe(false);
  });

  it('rejects different names at the same time', () => {
    expect(isSameClass(meeting(), meeting({ id: 'x', name: 'MATH 220' }))).toBe(false);
  });

  it('treats back-to-back classes as non-overlapping', () => {
    expect(isSameClass(
      meeting({ startMinute: 600, endMinute: 650 }),
      meeting({ id: 'x', startMinute: 650, endMinute: 700 })
    )).toBe(false);
  });
});

describe('findSharedClasses', () => {
  it('finds a class two students share on the days both attend', () => {
    const shared = findSharedClasses(
      [meeting({ days: [1, 3, 5] })],
      [meeting({ id: 'x', name: 'bio 101', days: [1, 3] })]
    );
    expect(shared.map((s) => s.day)).toEqual([1, 3]);
    expect(shared[0].name).toBe('BIO 101');
  });

  it('returns nothing when there is no overlap', () => {
    expect(findSharedClasses([meeting()], [meeting({ id: 'x', name: 'MATH 220' })])).toEqual([]);
  });

  it('returns nothing when one schedule is empty', () => {
    expect(findSharedClasses([meeting()], [])).toEqual([]);
    expect(findSharedClasses([], [meeting()])).toEqual([]);
  });
});

describe('computeMutualFree', () => {
  it('returns the whole window when neither student has a class', () => {
    expect(computeMutualFree([], [], 1)).toEqual([
      { start: DAY_START_MINUTE, end: DAY_END_MINUTE },
    ]);
  });

  it('finds the gap between two students classes', () => {
    const free = computeMutualFree(
      [meeting({ startMinute: 480, endMinute: 600 })],
      [meeting({ id: 'x', name: 'MATH 220', startMinute: 720, endMinute: 780 })],
      1
    );
    expect(free).toEqual([
      { start: 600, end: 720 },
      { start: 780, end: DAY_END_MINUTE },
    ]);
  });

  it('merges overlapping busy blocks from both students', () => {
    const free = computeMutualFree(
      [meeting({ startMinute: 480, endMinute: 660 })],
      [meeting({ id: 'x', name: 'MATH 220', startMinute: 600, endMinute: 720 })],
      1
    );
    expect(free).toEqual([{ start: 720, end: DAY_END_MINUTE }]);
  });

  it('discards gaps shorter than the 30 minute floor', () => {
    const free = computeMutualFree(
      [meeting({ startMinute: 480, endMinute: 600 })],
      [meeting({ id: 'x', name: 'MATH 220', startMinute: 620, endMinute: 1080 })],
      1
    );
    expect(free).toEqual([]);
  });

  it('keeps a gap exactly at the 30 minute floor', () => {
    const free = computeMutualFree(
      [meeting({ startMinute: 480, endMinute: 600 })],
      [meeting({ id: 'x', name: 'MATH 220', startMinute: 630, endMinute: 1080 })],
      1
    );
    expect(free).toEqual([{ start: 600, end: 630 }]);
  });

  it('reports leading free time before anyone has a class', () => {
    const free = computeMutualFree([meeting({ startMinute: 600, endMinute: 1080 })], [], 1);
    expect(free).toEqual([{ start: DAY_START_MINUTE, end: 600 }]);
  });

  it('clips classes that start before or end after the window', () => {
    const free = computeMutualFree([meeting({ startMinute: 420, endMinute: 540 })], [], 1);
    expect(free).toEqual([{ start: 540, end: DAY_END_MINUTE }]);
  });

  it('ignores classes on other days', () => {
    expect(computeMutualFree([meeting({ days: [2] })], [], 1)).toEqual([
      { start: DAY_START_MINUTE, end: DAY_END_MINUTE },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/__tests__/compare.test.ts`
Expected: FAIL — cannot resolve `../compare`.

- [ ] **Step 3: Write the implementation**

```ts
// src/domain/compare.ts
import { DAY_START_MINUTE, DAY_END_MINUTE, MIN_FREE_MINUTES } from './constants';
import { normalizeClassName } from './text';
import type { ClassMeeting, Interval } from './types';

export interface SharedClass {
  name: string;
  day: number;
  startMinute: number;
  endMinute: number;
}

/** Same class = same normalized name and genuinely overlapping time. */
export function isSameClass(a: ClassMeeting, b: ClassMeeting): boolean {
  if (normalizeClassName(a.name) !== normalizeClassName(b.name)) return false;
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

export function findSharedClasses(
  mine: ClassMeeting[],
  theirs: ClassMeeting[]
): SharedClass[] {
  const shared: SharedClass[] = [];

  for (const a of mine) {
    for (const b of theirs) {
      if (!isSameClass(a, b)) continue;
      for (const day of a.days) {
        if (!b.days.includes(day)) continue;
        shared.push({
          name: a.name,
          day,
          startMinute: Math.max(a.startMinute, b.startMinute),
          endMinute: Math.min(a.endMinute, b.endMinute),
        });
      }
    }
  }

  return shared.sort((x, y) => x.day - y.day || x.startMinute - y.startMinute);
}

/**
 * Free windows on one day where neither student has a class. Bounded by the
 * fixed 08:00–18:00 axis rather than the union of both students' active hours,
 * so "both free 08:00–09:30" is reported even when neither has an early class.
 */
export function computeMutualFree(
  mine: ClassMeeting[],
  theirs: ClassMeeting[],
  day: number
): Interval[] {
  const busy = [...mine, ...theirs]
    .filter((c) => c.days.includes(day))
    .map((c) => ({
      start: Math.max(c.startMinute, DAY_START_MINUTE),
      end: Math.min(c.endMinute, DAY_END_MINUTE),
    }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const interval of busy) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }

  const free: Interval[] = [];
  let cursor = DAY_START_MINUTE;
  for (const block of merged) {
    if (block.start - cursor >= MIN_FREE_MINUTES) free.push({ start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
  }
  if (DAY_END_MINUTE - cursor >= MIN_FREE_MINUTES) {
    free.push({ start: cursor, end: DAY_END_MINUTE });
  }

  return free;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/__tests__/compare.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npm test`
Expected: PASS — all 4 domain test files green.

```bash
git add src/domain/compare.ts src/domain/__tests__/compare.test.ts
git commit -m "feat: add shared class detection and mutual free time"
```

---

# Phase 3 — Database

### Task 8: Schema migration

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

- [ ] **Step 1: Write the migration**

`username` is plain `text` with a lowercase-only check plus a unique index, rather than `citext`. A `citext` regex match is case-insensitive, so a `^[a-z0-9_]+$` check would wrongly accept `MossB`. Forcing lowercase at write time makes both the constraint and the uniqueness unambiguous.

```sql
-- supabase/migrations/0001_schema.sql

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null,
  display_name  text,
  avatar_url    text,
  invite_code   text not null default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  created_at    timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create unique index profiles_username_key on public.profiles (username);
create unique index profiles_invite_code_key on public.profiles (invite_code);

create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  instructor    text,
  room          text,
  days          smallint[] not null,
  start_minute  smallint not null,
  end_minute    smallint not null,
  color         text not null,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  constraint classes_name_not_blank check (length(btrim(name)) > 0),
  constraint classes_time_order check (end_minute > start_minute),
  constraint classes_time_range check (start_minute >= 0 and end_minute <= 1440),
  constraint classes_days_count check (array_length(days, 1) between 1 and 7),
  constraint classes_days_range check (days <@ array[1,2,3,4,5,6,7]::smallint[])
);

create index classes_user_id_idx on public.classes (user_id);

create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  addressee_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- One row per unordered pair, regardless of who asked first.
create unique index friendships_pair_key on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

create table public.extraction_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index extraction_log_user_time_idx on public.extraction_log (user_id, created_at desc);
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase link --project-ref <your-project-ref>` then `npx supabase db push`
Expected: "Applying migration 0001_schema.sql... Finished".

- [ ] **Step 3: Verify the tables exist**

Run: `npx supabase db diff --schema public`
Expected: no differences reported — the local migration matches the remote schema.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_schema.sql
git commit -m "feat: add profiles, classes, friendships and extraction_log tables"
```

---

### Task 9: RLS policies

**Files:**
- Create: `supabase/migrations/0002_rls.sql`, `supabase/tests/rls_check.sql`

- [ ] **Step 1: Write the migration**

`are_friends` is `security definer` so that the `classes` select policy can consult `friendships` without triggering the `friendships` policies, which would recurse.

```sql
-- supabase/migrations/0002_rls.sql

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;

alter table public.profiles       enable row level security;
alter table public.classes        enable row level security;
alter table public.friendships    enable row level security;
alter table public.extraction_log enable row level security;

-- profiles: readable by any signed-in user so username search works.
-- Holds only username, display name, avatar and invite code.
create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- classes: mine, or an accepted friend's.
create policy classes_select on public.classes
  for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

create policy classes_insert on public.classes
  for insert to authenticated with check (user_id = auth.uid());

create policy classes_update on public.classes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy classes_delete on public.classes
  for delete to authenticated using (user_id = auth.uid());

-- friendships: visible to both parties; only the addressee can accept.
create policy friendships_select on public.friendships
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy friendships_insert on public.friendships
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

create policy friendships_update on public.friendships
  for update to authenticated
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status = 'accepted');

create policy friendships_delete on public.friendships
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- extraction_log: readable by its owner; written only by the Edge Function
-- using the service role key, which bypasses RLS.
create policy extraction_log_select on public.extraction_log
  for select to authenticated using (user_id = auth.uid());
```

- [ ] **Step 2: Write the RLS verification script**

```sql
-- supabase/tests/rls_check.sql
-- Verifies the one policy that would leak private data if wrong:
-- a non-friend must not be able to read another student's classes.
-- Run against a scratch database, not production.

begin;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev');

insert into public.profiles (id, username) values
  ('11111111-1111-1111-1111-111111111111', 'alpha'),
  ('22222222-2222-2222-2222-222222222222', 'bravo');

insert into public.classes (user_id, name, days, start_minute, end_minute, color)
values ('11111111-1111-1111-1111-111111111111', 'BIO 101', array[1,3]::smallint[], 600, 650, 'indigo');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- Not friends yet: bravo must see zero rows.
do $$
begin
  if (select count(*) from public.classes) <> 0 then
    raise exception 'LEAK: a non-friend can read classes';
  end if;
end $$;

reset role;
insert into public.friendships (requester_id, addressee_id, status)
values ('11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222', 'accepted');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.classes) <> 1 then
    raise exception 'BROKEN: an accepted friend cannot read classes';
  end if;
end $$;

rollback;
```

- [ ] **Step 3: Apply and run the check**

Run: `npx supabase db push`
Then: `npx supabase db execute --file supabase/tests/rls_check.sql`
Expected: completes without raising. Any `LEAK:` or `BROKEN:` exception is a hard failure — stop and fix the policy.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_rls.sql supabase/tests/rls_check.sql
git commit -m "feat: add RLS policies and a non-friend leak check"
```

---

# Phase 4 — Auth shell

### Task 10: Supabase client, auth provider and route guard

**Files:**
- Create: `src/lib/supabase.ts`, `src/features/auth/AuthProvider.tsx`, `src/features/auth/RequireAuth.tsx`, `src/features/auth/LoginPage.tsx`, `src/domain/mappers.ts`
- Modify: `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1: Create the Supabase client**

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.local.example to .env.local.');
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
```

- [ ] **Step 2: Create the row mappers**

Keeping snake_case confined to this one file means no other module has to think about database naming.

```ts
// src/domain/mappers.ts
import type { ClassMeeting, Profile } from './types';

export interface ClassRow {
  id: string;
  user_id: string;
  name: string;
  instructor: string | null;
  room: string | null;
  days: number[];
  start_minute: number;
  end_minute: number;
  color: string;
  sort_order: number;
}

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  invite_code: string;
}

export function rowToMeeting(row: ClassRow): ClassMeeting {
  return {
    id: row.id,
    name: row.name,
    instructor: row.instructor,
    room: row.room,
    days: row.days,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    color: row.color,
  };
}

export function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    inviteCode: row.invite_code,
  };
}
```

- [ ] **Step 3: Create the auth provider**

```tsx
// src/features/auth/AuthProvider.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { rowToProfile, type ProfileRow } from '@/domain/mappers';
import type { Profile } from '@/domain/types';

interface AuthValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, invite_code')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data ? rowToProfile(data as ProfileRow) : null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next) await loadProfile(next.user.id);
      else setProfile(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    session,
    profile,
    loading,
    refreshProfile: async () => {
      if (session) await loadProfile(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: Create the route guard and login page**

```tsx
// src/features/auth/RequireAuth.tsx
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import Spinner from '@/components/Spinner';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Loading" />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
```

```tsx
// src/features/auth/LoginPage.tsx
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import Button from '@/components/Button';

export default function LoginPage() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/" replace />;

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
  }

  return (
    <main className="flex min-h-dvh flex-col justify-between p-6">
      <div className="flex flex-1 flex-col justify-center gap-3">
        <h1 className="text-3xl font-bold">Schedule Matcher</h1>
        <p className="text-slate-600">
          Upload your schedule once. Stop texting screenshots.
        </p>
      </div>
      <Button onClick={signIn} className="w-full">Continue with Google</Button>
    </main>
  );
}
```

- [ ] **Step 5: Create the shared UI primitives**

```tsx
// src/components/Button.tsx
import type { ButtonHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-slate-900 text-white active:bg-slate-700 disabled:bg-slate-400',
  secondary: 'bg-white text-slate-900 border border-slate-300 active:bg-slate-100',
  ghost: 'bg-transparent text-slate-600 active:bg-slate-100',
};

export default function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={twMerge(
        'min-h-touch rounded-xl px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        className
      )}
    />
  );
}
```

```tsx
// src/components/Spinner.tsx
export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
        role="status"
        aria-label={label ?? 'Loading'}
      />
      {label && <p className="text-sm text-slate-500">{label}</p>}
    </div>
  );
}
```

```tsx
// src/components/EmptyState.tsx
import type { ReactNode } from 'react';

export default function EmptyState({
  title, body, action,
}: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-xs text-sm text-slate-600">{body}</p>
      {action}
    </div>
  );
}
```

- [ ] **Step 6: Wire the router in `src/App.tsx`**

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import RequireAuth from '@/features/auth/RequireAuth';
import LoginPage from '@/features/auth/LoginPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <div className="p-4">Signed in</div>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: Configure Google OAuth and verify sign-in**

In the Supabase dashboard: Authentication → Providers → Google, add the Google Cloud OAuth client ID and secret. Add `http://localhost:5173/` and the Vercel production URL to Redirect URLs.

Run: `npm run dev`, open `http://localhost:5173/login`, click Continue with Google.
Expected: Google consent screen, redirect back, page shows "Signed in" then redirects to `/onboarding` (which 404s until the next task — that is correct).

- [ ] **Step 8: Commit**

```bash
git add src/lib src/features/auth src/components src/domain/mappers.ts src/App.tsx
git commit -m "feat: add google auth, session provider and route guard"
```

---

### Task 11: Username onboarding

**Files:**
- Create: `src/features/auth/OnboardingPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the onboarding page**

The unique index on `username` is the real guard against a race between two students claiming the same handle; Postgres error `23505` is caught and shown as a friendly message rather than relying on a pre-check.

```tsx
// src/features/auth/OnboardingPage.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usernameSchema } from '@/domain/schema';
import { useAuth } from './AuthProvider';
import Button from '@/components/Button';

export default function OnboardingPage() {
  const { session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = usernameSchema.safeParse(username.trim().toLowerCase());
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from('profiles').insert({
      id: session!.user.id,
      username: parsed.data,
      display_name: session!.user.user_metadata.full_name ?? null,
      avatar_url: session!.user.user_metadata.avatar_url ?? null,
    });
    setSaving(false);

    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'That username is taken. Try another.'
          : 'Could not save your username. Try again.'
      );
      return;
    }

    await refreshProfile();
    navigate('/', { replace: true });
  }

  return (
    <main className="flex min-h-dvh flex-col p-6">
      <h1 className="mt-8 text-2xl font-bold">Pick a username</h1>
      <p className="mt-2 text-sm text-slate-600">
        This is how friends find you. Lowercase letters, numbers and underscores.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-1 flex-col">
        <label htmlFor="username" className="sr-only">Username</label>
        <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3">
          <span className="text-slate-400">@</span>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="moss_b21"
            className="min-h-touch w-full bg-transparent px-2 outline-none"
          />
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

        <Button type="submit" disabled={saving} className="mt-auto w-full">
          {saving ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Add the route in `src/App.tsx`**

Add this import and route alongside the existing ones:

```tsx
import OnboardingPage from '@/features/auth/OnboardingPage';

// inside <Routes>:
<Route
  path="/onboarding"
  element={
    <RequireAuth>
      <OnboardingPage />
    </RequireAuth>
  }
/>
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, sign in with a fresh Google account.
Expected: redirected to `/onboarding`; entering `MossB` shows the lowercase error; entering `moss_b21` saves and lands on `/`. Reloading goes straight to `/` and no longer to onboarding.

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/OnboardingPage.tsx src/App.tsx
git commit -m "feat: add username onboarding"
```

---

# Phase 5 — Extraction

### Task 12: `extract-schedule` Edge Function

**Files:**
- Create: `supabase/functions/extract-schedule/index.ts`, `supabase/functions/extract-schedule/prompt.ts`, `supabase/functions/extract-schedule/gemini.ts`

- [ ] **Step 1: Create the prompt and response schema**

Gemini's `responseSchema` forces structured output, which removes prose-parsing entirely. The prompt explicitly instructs the model to return an empty array rather than guess — a fabricated class is far worse than none.

```ts
// supabase/functions/extract-schedule/prompt.ts

export const SYSTEM_PROMPT = `You read a screenshot of a student's class schedule and return the classes as JSON.

Rules:
- Return one entry per distinct meeting time. If a class meets MWF at 10:00 and also Tuesday at 14:00, return TWO entries with the same name.
- days uses ISO weekday numbers: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday.
- startMinute and endMinute are minutes from midnight. 10:00 AM is 600. 1:15 PM is 795.
- Use null for instructor or room when the screenshot does not show them. Never invent a value.
- If the image is not a class schedule, or you cannot read it, return an empty classes array and explain why in warnings.
- Do not guess a time you cannot read. Omit the class and add a warning instead.`;

export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    classes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          instructor: { type: 'string', nullable: true },
          room: { type: 'string', nullable: true },
          days: { type: 'array', items: { type: 'integer' } },
          startMinute: { type: 'integer' },
          endMinute: { type: 'integer' },
        },
        required: ['name', 'days', 'startMinute', 'endMinute'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['classes', 'warnings'],
};
```

- [ ] **Step 2: Create the Gemini provider**

```ts
// supabase/functions/extract-schedule/gemini.ts
import { SYSTEM_PROMPT, RESPONSE_SCHEMA } from './prompt.ts';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface RawExtraction {
  classes: unknown[];
  warnings: string[];
}

/**
 * The single seam where the vision provider is chosen. Swapping providers
 * means writing another module with this signature and changing one import.
 */
export async function extractSchedule(
  image: { base64: string; mimeType: string },
  apiKey: string
): Promise<RawExtraction> {
  const response = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Extract every class from this schedule.' },
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (response.status === 429) throw new Error('PROVIDER_RATE_LIMITED');
  if (!response.ok) throw new Error(`PROVIDER_ERROR_${response.status}`);

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') throw new Error('PROVIDER_EMPTY_RESPONSE');

  const parsed = JSON.parse(text);
  return {
    classes: Array.isArray(parsed.classes) ? parsed.classes : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };
}
```

- [ ] **Step 3: Create the handler**

The function deliberately never writes to `classes`. It validates and returns; only an explicit save from the client persists anything.

```ts
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
```

- [ ] **Step 4: Set the secret and deploy**

Run:
```bash
npx supabase secrets set GEMINI_API_KEY=<your-gemini-key>
npx supabase functions deploy extract-schedule
```
Expected: "Deployed Function extract-schedule".

- [ ] **Step 5: Verify against a real screenshot**

Take any class-schedule screenshot, base64 it, and call the function with a valid user JWT:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/extract-schedule" \
  -H "Authorization: Bearer <a-real-user-jwt>" \
  -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"$(base64 -w0 schedule.png)\",\"mimeType\":\"image/png\"}"
```

Expected: JSON with a `classes` array whose entries have integer `startMinute`/`endMinute` and `days` in 1–7. Verify by eye that the times match the screenshot.

- [ ] **Step 6: Verify a non-image is rejected**

Run the same curl with `"mimeType":"text/plain"`.
Expected: `400 {"error":"BAD_IMAGE"}`.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/extract-schedule
git commit -m "feat: add extract-schedule edge function with gemini vision"
```

---

### Task 13: Upload, review and save flow

**Files:**
- Create: `src/domain/image.ts`, `src/features/upload/UploadPage.tsx`, `src/features/upload/ImagePicker.tsx`, `src/features/upload/ReviewForm.tsx`, `src/features/upload/ClassCard.tsx`, `src/features/schedule/useSchedule.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the image downscaler**

Phone screenshots are large and students are on cellular. This is a browser-only module using canvas, so it is verified manually rather than unit tested.

```ts
// src/domain/image.ts
import { MAX_IMAGE_EDGE } from './constants';

export async function downscaleImage(file: File): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable on this device.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
}
```

- [ ] **Step 2: Create the schedule data hook**

Replacing the schedule is a delete-then-insert. At this scale a brief window with no rows is acceptable; wrapping it in an RPC transaction is a documented follow-up, not a v1 need.

```ts
// src/features/schedule/useSchedule.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { rowToMeeting, type ClassRow } from '@/domain/mappers';
import { colorForClass } from '@/domain/color';
import type { ClassMeeting, ExtractedClass } from '@/domain/types';

export function useSchedule(userId: string | undefined) {
  const [classes, setClasses] = useState<ClassMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('classes')
      .select('id, user_id, name, instructor, room, days, start_minute, end_minute, color, sort_order')
      .eq('user_id', userId)
      .order('sort_order');

    if (queryError) setError('Could not load this schedule.');
    else setClasses((data as ClassRow[]).map(rowToMeeting));
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  return { classes, loading, error, reload: load };
}

/** Replaces the caller's entire schedule with `next`. */
export async function saveSchedule(userId: string, next: ExtractedClass[]) {
  const { error: deleteError } = await supabase.from('classes').delete().eq('user_id', userId);
  if (deleteError) throw new Error('Could not clear your old schedule.');

  if (next.length === 0) return;

  const rows = next.map((c, index) => ({
    user_id: userId,
    name: c.name,
    instructor: c.instructor,
    room: c.room,
    days: c.days,
    start_minute: c.startMinute,
    end_minute: c.endMinute,
    color: colorForClass(c.name),
    sort_order: index,
  }));

  const { error: insertError } = await supabase.from('classes').insert(rows);
  if (insertError) throw new Error('Could not save your schedule.');
}
```

- [ ] **Step 3: Create the image picker**

```tsx
// src/features/upload/ImagePicker.tsx
import { useRef } from 'react';
import Button from '@/components/Button';

export default function ImagePicker({ onPick }: { onPick: (file: File) => void }) {
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onPick(file);
    event.target.value = '';
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={libraryRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleChange} className="hidden" />

      <Button onClick={() => libraryRef.current?.click()} className="w-full">
        Choose a screenshot
      </Button>
      <Button variant="secondary" onClick={() => cameraRef.current?.click()} className="w-full">
        Take a photo
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Create the editable class card**

One card per class, not a table — a table is unusable at 390px. Day chips are 44px, and times use the native picker.

```tsx
// src/features/upload/ClassCard.tsx
import { ALL_WEEKDAYS, WEEKDAY_INITIALS } from '@/domain/constants';
import { toTimeInputValue, parseTimeToMinutes } from '@/domain/time';
import type { ExtractedClass } from '@/domain/types';
import Button from '@/components/Button';

interface Props {
  value: ExtractedClass;
  index: number;
  onChange: (next: ExtractedClass) => void;
  onRemove: () => void;
}

export default function ClassCard({ value, index, onChange, onRemove }: Props) {
  const invalidTime = value.endMinute <= value.startMinute;

  function toggleDay(day: number) {
    const days = value.days.includes(day)
      ? value.days.filter((d) => d !== day)
      : [...value.days, day].sort((a, b) => a - b);
    onChange({ ...value, days });
  }

  function setTime(field: 'startMinute' | 'endMinute', raw: string) {
    const minutes = parseTimeToMinutes(raw);
    if (minutes !== null) onChange({ ...value, [field]: minutes });
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <label className="text-xs font-medium text-slate-500" htmlFor={`name-${index}`}>Class</label>
      <input
        id={`name-${index}`}
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="BIO 101"
        className="min-h-touch w-full rounded-lg border border-slate-300 px-3"
      />

      <p className="mt-3 text-xs font-medium text-slate-500">Days</p>
      <div className="mt-1 flex gap-1.5">
        {ALL_WEEKDAYS.map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={value.days.includes(day)}
            aria-label={`Day ${day}`}
            onClick={() => toggleDay(day)}
            className={`min-h-touch min-w-touch flex-1 rounded-lg border text-sm font-semibold ${
              value.days.includes(day)
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            {WEEKDAY_INITIALS[day]}
          </button>
        ))}
      </div>
      {value.days.length === 0 && (
        <p className="mt-1 text-xs text-rose-600">Pick at least one day.</p>
      )}

      <div className="mt-3 flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500" htmlFor={`start-${index}`}>Starts</label>
          <input
            id={`start-${index}`}
            type="time"
            value={toTimeInputValue(value.startMinute)}
            onChange={(e) => setTime('startMinute', e.target.value)}
            className="min-h-touch w-full rounded-lg border border-slate-300 px-3"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500" htmlFor={`end-${index}`}>Ends</label>
          <input
            id={`end-${index}`}
            type="time"
            value={toTimeInputValue(value.endMinute)}
            onChange={(e) => setTime('endMinute', e.target.value)}
            className="min-h-touch w-full rounded-lg border border-slate-300 px-3"
          />
        </div>
      </div>
      {invalidTime && <p className="mt-1 text-xs text-rose-600">End time must be after the start.</p>}

      <div className="mt-3 flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500" htmlFor={`room-${index}`}>Room</label>
          <input
            id={`room-${index}`}
            value={value.room ?? ''}
            onChange={(e) => onChange({ ...value, room: e.target.value || null })}
            placeholder="Optional"
            className={`min-h-touch w-full rounded-lg border px-3 ${
              value.room ? 'border-slate-300' : 'border-amber-300 bg-amber-50'
            }`}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-slate-500" htmlFor={`instructor-${index}`}>Instructor</label>
          <input
            id={`instructor-${index}`}
            value={value.instructor ?? ''}
            onChange={(e) => onChange({ ...value, instructor: e.target.value || null })}
            placeholder="Optional"
            className={`min-h-touch w-full rounded-lg border px-3 ${
              value.instructor ? 'border-slate-300' : 'border-amber-300 bg-amber-50'
            }`}
          />
        </div>
      </div>

      <Button variant="ghost" onClick={onRemove} className="mt-2 w-full text-rose-600">
        Remove class
      </Button>
    </li>
  );
}
```

- [ ] **Step 5: Create the review form**

```tsx
// src/features/upload/ReviewForm.tsx
import { useState } from 'react';
import ClassCard from './ClassCard';
import Button from '@/components/Button';
import { DAY_START_MINUTE } from '@/domain/constants';
import type { ExtractedClass } from '@/domain/types';

interface Props {
  initial: ExtractedClass[];
  warnings: string[];
  saving: boolean;
  onSave: (classes: ExtractedClass[]) => void;
}

const BLANK: ExtractedClass = {
  name: '', instructor: null, room: null,
  days: [], startMinute: DAY_START_MINUTE, endMinute: DAY_START_MINUTE + 50,
};

export default function ReviewForm({ initial, warnings, saving, onSave }: Props) {
  const [classes, setClasses] = useState<ExtractedClass[]>(initial);

  const valid =
    classes.length > 0 &&
    classes.every((c) => c.name.trim() && c.days.length > 0 && c.endMinute > c.startMinute);

  return (
    <div className="pb-28">
      {warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">Check these</p>
          <ul className="mt-1 list-disc pl-4 text-sm text-amber-900">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {classes.map((c, i) => (
          <ClassCard
            key={i}
            index={i}
            value={c}
            onChange={(next) => setClasses(classes.map((old, j) => (j === i ? next : old)))}
            onRemove={() => setClasses(classes.filter((_, j) => j !== i))}
          />
        ))}
      </ul>

      <Button
        variant="secondary"
        onClick={() => setClasses([...classes, { ...BLANK }])}
        className="mt-3 w-full"
      >
        Add a class
      </Button>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <Button disabled={!valid || saving} onClick={() => onSave(classes)} className="w-full">
          {saving ? 'Saving…' : 'Save schedule'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create the upload page**

Every failure path lands in the same review form, empty — a throttled key degrades the experience but never blocks a student from having a schedule.

```tsx
// src/features/upload/UploadPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { downscaleImage } from '@/domain/image';
import { extractionResponseSchema } from '@/domain/schema';
import { saveSchedule } from '@/features/schedule/useSchedule';
import { useAuth } from '@/features/auth/AuthProvider';
import ImagePicker from './ImagePicker';
import ReviewForm from './ReviewForm';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';
import type { ExtractedClass } from '@/domain/types';

type Stage =
  | { name: 'picking' }
  | { name: 'extracting' }
  | { name: 'reviewing'; classes: ExtractedClass[]; warnings: string[] };

const MESSAGES: Record<string, string> = {
  RATE_LIMITED: "You've hit the upload limit for this hour. Enter your classes manually, or try again later.",
  PROVIDER_RATE_LIMITED: 'The reader is busy right now. Try again in a few minutes, or enter your classes manually.',
  IMAGE_TOO_LARGE: 'That image is too large. Try a screenshot rather than a photo.',
  BAD_IMAGE: "That file isn't an image we can read.",
};

/**
 * supabase-js wraps a non-2xx Edge Function reply in a FunctionsHttpError whose
 * `context` is the raw Response, so the JSON body has to be read off it to get
 * our error code. Reading `caught.context.error` directly returns undefined.
 */
async function errorCodeOf(caught: unknown): Promise<string> {
  const context = (caught as { context?: Response }).context;
  if (!context || typeof context.json !== 'function') return '';
  try {
    const body = (await context.json()) as { error?: string };
    return typeof body.error === 'string' ? body.error : '';
  } catch {
    return '';
  }
}

export default function UploadPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ name: 'picking' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startManual() {
    setError(null);
    setStage({ name: 'reviewing', classes: [], warnings: [] });
  }

  async function handlePick(file: File) {
    setError(null);
    setStage({ name: 'extracting' });

    try {
      const image = await downscaleImage(file);
      const { data, error: fnError } = await supabase.functions.invoke('extract-schedule', {
        body: { imageBase64: image.base64, mimeType: image.mimeType },
      });

      if (fnError) throw fnError;

      const payload = extractionResponseSchema.safeParse(data);
      if (!payload.success) {
        setError('We could not read that schedule. Enter your classes manually.');
        setStage({ name: 'reviewing', classes: [], warnings: [] });
        return;
      }

      setStage({
        name: 'reviewing',
        classes: payload.data.classes,
        warnings: payload.data.classes.length === 0
          ? ['No classes found in that image.', ...payload.data.warnings]
          : payload.data.warnings,
      });
    } catch (caught) {
      setError(MESSAGES[await errorCodeOf(caught)] ?? 'Something went wrong reading that image. Enter your classes manually.');
      setStage({ name: 'reviewing', classes: [], warnings: [] });
    }
  }

  async function handleSave(classes: ExtractedClass[]) {
    setSaving(true);
    try {
      await saveSchedule(session!.user.id, classes);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your schedule.');
    } finally {
      setSaving(false);
    }
  }

  if (stage.name === 'extracting') return <Spinner label="Reading your schedule…" />;

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">Add your schedule</h1>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      {stage.name === 'picking' ? (
        <>
          <p className="mt-2 text-sm text-slate-600">
            Upload a screenshot and we'll turn it into a real schedule. You can fix anything we misread.
          </p>
          <div className="mt-6">
            <ImagePicker onPick={handlePick} />
          </div>
          <Button variant="ghost" onClick={startManual} className="mt-3 w-full">
            Enter manually instead
          </Button>
        </>
      ) : (
        <div className="mt-4">
          <ReviewForm
            initial={stage.classes}
            warnings={stage.warnings}
            saving={saving}
            onSave={handleSave}
          />
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Add the route and verify end to end**

Add to `src/App.tsx` inside `<Routes>`:

```tsx
import UploadPage from '@/features/upload/UploadPage';

<Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
```

Run: `npm run dev`, open `/upload` in a mobile viewport (Chrome DevTools, 390×844), upload a real schedule screenshot.
Expected: spinner, then a card per class with plausible times; editing a time and saving redirects to `/`; the `classes` table in Supabase contains the rows.

- [ ] **Step 8: Verify the fallback path**

Temporarily set `GEMINI_API_KEY` to an invalid value and redeploy, then upload again.
Expected: an error banner plus an empty review form you can still fill in and save. Restore the real key afterwards.

- [ ] **Step 9: Commit**

```bash
git add src/domain/image.ts src/features/upload src/features/schedule/useSchedule.ts src/App.tsx
git commit -m "feat: add upload, extraction review and save flow"
```

---

# Phase 6 — Schedule display

### Task 14: Schedule grid

**Files:**
- Create: `src/features/schedule/ClassBlock.tsx`, `src/features/schedule/DaySelector.tsx`, `src/features/schedule/ScheduleGrid.tsx`, `src/features/schedule/SchedulePage.tsx`, `src/components/BottomNav.tsx`, `src/components/AppShell.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the class block**

```tsx
// src/features/schedule/ClassBlock.tsx
import { CLASS_COLORS } from '@/domain/color';
import { formatMinutes } from '@/domain/time';
import type { PositionedBlock } from '@/domain/layout';

export default function ClassBlock({ block }: { block: PositionedBlock }) {
  const styles = CLASS_COLORS[block.meeting.color] ?? CLASS_COLORS.indigo;
  const widthPct = 100 / block.laneCount;

  return (
    <div
      className={`absolute overflow-hidden rounded-lg border px-2 py-1 ${styles.block} ${styles.text}`}
      style={{
        top: `${block.topPct}%`,
        height: `${block.heightPct}%`,
        left: `${block.lane * widthPct}%`,
        width: `${widthPct}%`,
      }}
    >
      <p className="truncate text-xs font-semibold leading-tight">{block.meeting.name}</p>
      <p className="truncate text-[10px] leading-tight opacity-80">
        {formatMinutes(block.meeting.startMinute)}
      </p>
      {block.meeting.room && (
        <p className="truncate text-[10px] leading-tight opacity-80">{block.meeting.room}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the day selector**

```tsx
// src/features/schedule/DaySelector.tsx
import { WEEKDAY_LABELS } from '@/domain/constants';

interface Props {
  days: number[];
  selected: number;
  onSelect: (day: number) => void;
}

export default function DaySelector({ days, selected, onSelect }: Props) {
  return (
    <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-slate-50/95 px-4 py-3 backdrop-blur lg:hidden">
      {days.map((day) => (
        <button
          key={day}
          type="button"
          aria-pressed={day === selected}
          onClick={() => onSelect(day)}
          className={`min-h-touch flex-1 rounded-full px-4 text-sm font-semibold ${
            day === selected ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          {WEEKDAY_LABELS[day]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the grid**

Mobile renders one day; `lg:` renders the whole week. Both call the same `computeLayout`, only the `days` argument differs.

```tsx
// src/features/schedule/ScheduleGrid.tsx
import { useState } from 'react';
import { computeAxis, computeLayout, axisHours } from '@/domain/layout';
import { formatHourLabel } from '@/domain/time';
import { WEEKDAYS, WEEKDAY_LABELS } from '@/domain/constants';
import type { ClassMeeting } from '@/domain/types';
import DaySelector from './DaySelector';
import ClassBlock from './ClassBlock';

const HOUR_HEIGHT_PX = 64;

function todayWeekday(): number {
  const iso = new Date().getDay();
  return iso === 0 ? 7 : iso;
}

export default function ScheduleGrid({ classes }: { classes: ClassMeeting[] }) {
  const weekendDays = [6, 7].filter((d) => classes.some((c) => c.days.includes(d)));
  const days = [...WEEKDAYS, ...weekendDays];

  const initial = days.includes(todayWeekday()) ? todayWeekday() : days[0];
  const [selectedDay, setSelectedDay] = useState(initial);

  const axis = computeAxis(classes);
  const hours = axisHours(axis);
  const gridHeight = ((axis.endMinute - axis.startMinute) / 60) * HOUR_HEIGHT_PX;

  const mobileBlocks = computeLayout(classes, [selectedDay], axis);
  const desktopBlocks = computeLayout(classes, days, axis);

  return (
    <>
      <DaySelector days={days} selected={selectedDay} onSelect={setSelectedDay} />

      <div className="flex px-4 pb-6">
        <div className="w-12 shrink-0" style={{ height: gridHeight }}>
          {hours.map((minute, i) => (
            <div key={minute} className="relative" style={{ height: HOUR_HEIGHT_PX }}>
              {i < hours.length - 1 && (
                <span className="absolute -top-2 right-2 text-[10px] text-slate-400">
                  {formatHourLabel(minute)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Mobile: one day */}
        <div className="relative flex-1 lg:hidden" style={{ height: gridHeight }}>
          {hours.map((minute) => (
            <div key={minute} className="border-t border-slate-200" style={{ height: HOUR_HEIGHT_PX }} />
          ))}
          <div className="absolute inset-0">
            {mobileBlocks.map((block) => (
              <ClassBlock key={`${block.meeting.id}-${block.day}`} block={block} />
            ))}
          </div>
        </div>

        {/* Desktop: full week */}
        <div className="hidden flex-1 lg:flex">
          {days.map((day) => (
            <div key={day} className="flex-1 border-l border-slate-200">
              <p className="py-1 text-center text-xs font-semibold text-slate-500">
                {WEEKDAY_LABELS[day]}
              </p>
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((minute) => (
                  <div key={minute} className="border-t border-slate-200" style={{ height: HOUR_HEIGHT_PX }} />
                ))}
                <div className="absolute inset-0">
                  {desktopBlocks
                    .filter((b) => b.day === day)
                    .map((block) => (
                      <ClassBlock key={`${block.meeting.id}-${block.day}`} block={block} />
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Create the bottom nav and app shell**

```tsx
// src/components/BottomNav.tsx
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Schedule' },
  { to: '/friends', label: 'Friends' },
  { to: '/profile', label: 'Profile' },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="flex">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex min-h-touch items-center justify-center py-3 text-sm font-medium ${
                  isActive ? 'text-slate-900' : 'text-slate-400'
                }`
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

```tsx
// src/components/AppShell.tsx
import type { ReactNode } from 'react';
import BottomNav from './BottomNav';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-20 lg:pb-0">
      {children}
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 5: Create the schedule page**

```tsx
// src/features/schedule/SchedulePage.tsx
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSchedule } from './useSchedule';
import ScheduleGrid from './ScheduleGrid';
import EmptyState from '@/components/EmptyState';
import Spinner from '@/components/Spinner';
import Button from '@/components/Button';

export default function SchedulePage() {
  const { session, profile } = useAuth();
  const { classes, loading, error } = useSchedule(session?.user.id);

  if (loading) return <Spinner label="Loading your schedule" />;

  return (
    <main>
      <header className="flex items-center justify-between px-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold">My schedule</h1>
          <p className="text-sm text-slate-500">@{profile?.username}</p>
        </div>
        <Link to="/upload">
          <Button variant="secondary">{classes.length > 0 ? 'Replace' : 'Add'}</Button>
        </Link>
      </header>

      {error && <p className="px-4 pt-3 text-sm text-rose-600">{error}</p>}

      {classes.length === 0 ? (
        <EmptyState
          title="No schedule yet"
          body="Upload a screenshot of your classes and we'll turn it into a real schedule."
          action={<Link to="/upload"><Button>Upload a screenshot</Button></Link>}
        />
      ) : (
        <div className="mt-2">
          <ScheduleGrid classes={classes} />
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 6: Wire the routes**

Replace the placeholder `/` route in `src/App.tsx`:

```tsx
import AppShell from '@/components/AppShell';
import SchedulePage from '@/features/schedule/SchedulePage';

<Route path="/" element={<RequireAuth><AppShell><SchedulePage /></AppShell></RequireAuth>} />
```

- [ ] **Step 7: Verify at mobile and desktop widths**

Run: `npm run dev`, view `/` at 390×844 and at 1280 wide.
Expected: at 390px a single day column with day chips, today selected by default, blocks positioned correctly against the hour lines, bottom nav visible and not overlapping content. At 1280px the full Mon–Fri week with no day chips. A class outside 08:00–18:00 is visible with the axis extended.

- [ ] **Step 8: Commit**

```bash
git add src/features/schedule src/components src/App.tsx
git commit -m "feat: add mobile-first schedule grid and app shell"
```

**Milestone: the app is now usable end-to-end for a single student.**

---

# Phase 7 — Friends

### Task 15: Friends data layer

**Files:**
- Create: `src/features/friends/useFriends.ts`

- [ ] **Step 1: Create the hook and mutations**

```ts
// src/features/friends/useFriends.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { rowToProfile, type ProfileRow } from '@/domain/mappers';
import type { Profile } from '@/domain/types';

export interface FriendRequest {
  id: string;
  profile: Profile;
  direction: 'incoming' | 'outgoing';
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  requester: ProfileRow;
  addressee: ProfileRow;
}

const SELECT = `
  id, requester_id, addressee_id, status,
  requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url, invite_code),
  addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url, invite_code)
`;

export function useFriends(userId: string | undefined) {
  const [friends, setFriends] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data } = await supabase.from('friendships').select(SELECT);
    const rows = (data ?? []) as unknown as FriendshipRow[];

    setFriends(
      rows
        .filter((r) => r.status === 'accepted')
        .map((r) => rowToProfile(r.requester_id === userId ? r.addressee : r.requester))
    );

    setRequests(
      rows
        .filter((r) => r.status === 'pending')
        .map((r) => ({
          id: r.id,
          profile: rowToProfile(r.requester_id === userId ? r.addressee : r.requester),
          direction: r.requester_id === userId ? ('outgoing' as const) : ('incoming' as const),
        }))
    );

    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  return { friends, requests, loading, reload: load };
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  const { error } = await supabase.from('friendships').insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: 'pending',
  });
  if (error) {
    throw new Error(
      error.code === '23505'
        ? "You're already connected or a request is pending."
        : 'Could not send that request.'
    );
  }
}

export async function acceptFriendRequest(friendshipId: string) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', friendshipId);
  if (error) throw new Error('Could not accept that request.');
}

/** Declining and unfriending are the same operation: delete the row. */
export async function removeFriendship(friendshipId: string) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw new Error('Could not update that request.');
}

export async function searchProfiles(query: string, excludeId: string): Promise<Profile[]> {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];

  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, invite_code')
    .ilike('username', `${term}%`)
    .neq('id', excludeId)
    .limit(10);

  return ((data ?? []) as ProfileRow[]).map(rowToProfile);
}

export async function findProfileByInviteCode(code: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, invite_code')
    .eq('invite_code', code)
    .maybeSingle();

  return data ? rowToProfile(data as ProfileRow) : null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/friends/useFriends.ts
git commit -m "feat: add friends data layer"
```

---

### Task 16: Friends page

**Files:**
- Create: `src/features/friends/FriendSearch.tsx`, `src/features/friends/PendingRequests.tsx`, `src/features/friends/FriendsPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the search component**

```tsx
// src/features/friends/FriendSearch.tsx
import { useState } from 'react';
import { searchProfiles, sendFriendRequest } from './useFriends';
import Button from '@/components/Button';
import type { Profile } from '@/domain/types';

interface Props {
  userId: string;
  onSent: () => void;
}

export default function FriendSearch({ userId, onSent }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function handleChange(value: string) {
    setQuery(value);
    setMessage(null);
    setResults(await searchProfiles(value, userId));
  }

  async function handleSend(target: Profile) {
    try {
      await sendFriendRequest(userId, target.id);
      setMessage(`Request sent to @${target.username}.`);
      setResults(results.filter((r) => r.id !== target.id));
      onSent();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send that request.');
    }
  }

  return (
    <section className="px-4">
      <label htmlFor="search" className="text-xs font-medium text-slate-500">Find by username</label>
      <input
        id="search"
        value={query}
        onChange={(e) => void handleChange(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="username"
        className="min-h-touch mt-1 w-full rounded-xl border border-slate-300 px-3"
      />

      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}

      <ul className="mt-2 flex flex-col gap-2">
        {results.map((profile) => (
          <li key={profile.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <p className="font-semibold">@{profile.username}</p>
              {profile.displayName && <p className="text-sm text-slate-500">{profile.displayName}</p>}
            </div>
            <Button variant="secondary" onClick={() => void handleSend(profile)}>Add</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Create the pending requests component**

```tsx
// src/features/friends/PendingRequests.tsx
import { acceptFriendRequest, removeFriendship, type FriendRequest } from './useFriends';
import Button from '@/components/Button';

interface Props {
  requests: FriendRequest[];
  onChanged: () => void;
}

export default function PendingRequests({ requests, onChanged }: Props) {
  if (requests.length === 0) return null;

  return (
    <section className="px-4">
      <h2 className="text-sm font-semibold text-slate-500">Requests</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {requests.map((request) => (
          <li key={request.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <p className="font-semibold">@{request.profile.username}</p>
              <p className="text-xs text-slate-500">
                {request.direction === 'incoming' ? 'Wants to connect' : 'Request sent'}
              </p>
            </div>
            <div className="flex gap-2">
              {request.direction === 'incoming' && (
                <Button onClick={async () => { await acceptFriendRequest(request.id); onChanged(); }}>
                  Accept
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={async () => { await removeFriendship(request.id); onChanged(); }}
              >
                {request.direction === 'incoming' ? 'Decline' : 'Cancel'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Create the friends page**

```tsx
// src/features/friends/FriendsPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFriends } from './useFriends';
import FriendSearch from './FriendSearch';
import PendingRequests from './PendingRequests';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

export default function FriendsPage() {
  const { session, profile } = useAuth();
  const { friends, requests, loading, reload } = useFriends(session?.user.id);
  const [copied, setCopied] = useState(false);

  if (loading) return <Spinner label="Loading friends" />;

  const inviteUrl = `${window.location.origin}/invite/${profile?.inviteCode}`;

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="flex flex-col gap-6 pb-6">
      <header className="px-4 pt-4">
        <h1 className="text-2xl font-bold">Friends</h1>
      </header>

      <section className="px-4">
        <Button variant="secondary" onClick={() => void copyInvite()} className="w-full">
          {copied ? 'Link copied' : 'Copy my invite link'}
        </Button>
      </section>

      <PendingRequests requests={requests} onChanged={reload} />

      <FriendSearch userId={session!.user.id} onSent={reload} />

      <section className="px-4">
        <h2 className="text-sm font-semibold text-slate-500">Your friends</h2>
        {friends.length === 0 ? (
          <EmptyState title="No friends yet" body="Search for a username or share your invite link." />
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {friends.map((friend) => (
              <li key={friend.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                <Link to={`/u/${friend.username}`} className="flex-1">
                  <p className="font-semibold">@{friend.username}</p>
                  {friend.displayName && <p className="text-sm text-slate-500">{friend.displayName}</p>}
                </Link>
                <Link to={`/compare/${friend.username}`}>
                  <Button variant="secondary">Compare</Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add the route**

```tsx
import FriendsPage from '@/features/friends/FriendsPage';

<Route path="/friends" element={<RequireAuth><AppShell><FriendsPage /></AppShell></RequireAuth>} />
```

- [ ] **Step 5: Verify with two accounts**

Run: `npm run dev`. Sign in as account A in a normal window and account B in a private window.
Expected: A searches B's username and sends a request; B sees it under Requests and accepts; both then see each other under Your friends. A second request from A to B is rejected with "You're already connected or a request is pending."

- [ ] **Step 6: Commit**

```bash
git add src/features/friends src/App.tsx
git commit -m "feat: add friends page with search, requests and invite link"
```

---

### Task 17: Invite links and friend schedule view

**Files:**
- Create: `src/features/friends/InvitePage.tsx`, `src/features/friends/FriendSchedulePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the invite page**

```tsx
// src/features/friends/InvitePage.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { findProfileByInviteCode, sendFriendRequest } from './useFriends';
import Spinner from '@/components/Spinner';
import Button from '@/components/Button';
import type { Profile } from '@/domain/types';

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const { session, profile } = useAuth();
  const [target, setTarget] = useState<Profile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'sent' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      const found = await findProfileByInviteCode(code!);
      if (!found) {
        setMessage('That invite link is not valid.');
        setStatus('error');
        return;
      }
      if (found.id === session?.user.id) {
        setMessage('That is your own invite link.');
        setStatus('error');
        return;
      }
      setTarget(found);
      setStatus('ready');
    }
    void run();
  }, [code, session?.user.id]);

  async function handleSend() {
    try {
      await sendFriendRequest(session!.user.id, target!.id);
      setStatus('sent');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send that request.');
      setStatus('error');
    }
  }

  if (status === 'loading') return <Spinner label="Checking that link" />;

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 p-6 text-center">
      {status === 'error' && <p className="text-slate-700">{message}</p>}

      {status === 'ready' && target && (
        <>
          <p className="text-lg">
            Connect with <span className="font-bold">@{target.username}</span>?
          </p>
          <Button onClick={() => void handleSend()}>Send request</Button>
        </>
      )}

      {status === 'sent' && target && (
        <p className="text-lg">Request sent to @{target.username}.</p>
      )}

      <Link to="/friends" className="text-sm text-slate-500 underline">
        {profile ? 'Back to friends' : 'Continue'}
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Create the friend schedule page**

RLS is what enforces access here: a non-friend's query returns zero rows, so "no schedule" and "not allowed" look the same to the client, which is exactly right.

```tsx
// src/features/friends/FriendSchedulePage.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { rowToMeeting, rowToProfile, type ClassRow, type ProfileRow } from '@/domain/mappers';
import ScheduleGrid from '@/features/schedule/ScheduleGrid';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import Button from '@/components/Button';
import type { ClassMeeting, Profile } from '@/domain/types';

export default function FriendSchedulePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [classes, setClasses] = useState<ClassMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      setLoading(true);
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, invite_code')
        .eq('username', username!)
        .maybeSingle();

      if (!profileRow) { setLoading(false); return; }
      const found = rowToProfile(profileRow as ProfileRow);
      setProfile(found);

      const { data: classRows } = await supabase
        .from('classes')
        .select('id, user_id, name, instructor, room, days, start_minute, end_minute, color, sort_order')
        .eq('user_id', found.id)
        .order('sort_order');

      setClasses(((classRows ?? []) as ClassRow[]).map(rowToMeeting));
      setLoading(false);
    }
    void run();
  }, [username]);

  if (loading) return <Spinner label="Loading schedule" />;
  if (!profile) return <EmptyState title="Not found" body="No student with that username." />;

  return (
    <main>
      <header className="flex items-center justify-between px-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold">@{profile.username}</h1>
          {profile.displayName && <p className="text-sm text-slate-500">{profile.displayName}</p>}
        </div>
        <Link to={`/compare/${profile.username}`}>
          <Button variant="secondary">Compare</Button>
        </Link>
      </header>

      {classes.length === 0 ? (
        <EmptyState title="No schedule yet" body="They haven't added their schedule yet." />
      ) : (
        <div className="mt-2"><ScheduleGrid classes={classes} /></div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Add the routes**

```tsx
import InvitePage from '@/features/friends/InvitePage';
import FriendSchedulePage from '@/features/friends/FriendSchedulePage';

<Route path="/invite/:code" element={<RequireAuth><InvitePage /></RequireAuth>} />
<Route path="/u/:username" element={<RequireAuth><AppShell><FriendSchedulePage /></AppShell></RequireAuth>} />
```

- [ ] **Step 4: Verify**

With two accounts: copy A's invite link, open it as B.
Expected: "Connect with @a?" then "Request sent". After A accepts, B opening `/u/a` sees A's grid. Before accepting, `/u/a` shows "They haven't added their schedule yet" because RLS returns no rows — confirm this by checking that A does have classes saved.

- [ ] **Step 5: Commit**

```bash
git add src/features/friends src/App.tsx
git commit -m "feat: add invite links and friend schedule view"
```

---

# Phase 8 — Compare

### Task 18: Compare view

**Files:**
- Create: `src/features/compare/CompareSummary.tsx`, `src/features/compare/CompareGrid.tsx`, `src/features/compare/ComparePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the summary**

Often the only part a student actually needs, and it reads well on a phone.

```tsx
// src/features/compare/CompareSummary.tsx
import { WEEKDAY_LABELS } from '@/domain/constants';
import { formatMinutes } from '@/domain/time';
import type { SharedClass } from '@/domain/compare';
import type { Interval } from '@/domain/types';

interface Props {
  shared: SharedClass[];
  freeByDay: Record<number, Interval[]>;
  days: number[];
}

export default function CompareSummary({ shared, freeByDay, days }: Props) {
  const sharedNames = [...new Set(shared.map((s) => s.name))];

  return (
    <section className="mx-4 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-500">Summary</h2>

      <p className="mt-2 text-sm">
        {sharedNames.length === 0
          ? 'No classes in common.'
          : `${sharedNames.length} shared ${sharedNames.length === 1 ? 'class' : 'classes'}: ${sharedNames.join(', ')}`}
      </p>

      <h3 className="mt-3 text-sm font-semibold text-slate-500">Both free</h3>
      <ul className="mt-1 flex flex-col gap-1 text-sm">
        {days.map((day) => {
          const windows = freeByDay[day] ?? [];
          return (
            <li key={day} className="flex gap-2">
              <span className="w-10 shrink-0 font-medium text-slate-500">{WEEKDAY_LABELS[day]}</span>
              <span className="text-slate-700">
                {windows.length === 0
                  ? 'Nothing'
                  : windows.map((w) => `${formatMinutes(w.start)}–${formatMinutes(w.end)}`).join(', ')}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Create the compare grid**

Two 50% lanes within one day column, shared classes merged full-width, mutual free time as a tinted band behind everything.

```tsx
// src/features/compare/CompareGrid.tsx
import { useState } from 'react';
import { computeAxis, computeLayout, axisHours } from '@/domain/layout';
import { isSameClass } from '@/domain/compare';
import { formatHourLabel, formatMinutes } from '@/domain/time';
import { CLASS_COLORS } from '@/domain/color';
import type { ClassMeeting, Interval } from '@/domain/types';
import DaySelector from '@/features/schedule/DaySelector';

const HOUR_HEIGHT_PX = 64;

interface Props {
  mine: ClassMeeting[];
  theirs: ClassMeeting[];
  days: number[];
  freeByDay: Record<number, Interval[]>;
  theirUsername: string;
}

export default function CompareGrid({ mine, theirs, days, freeByDay, theirUsername }: Props) {
  const [selectedDay, setSelectedDay] = useState(days[0]);

  const axis = computeAxis([...mine, ...theirs]);
  const hours = axisHours(axis);
  const span = axis.endMinute - axis.startMinute;
  const gridHeight = (span / 60) * HOUR_HEIGHT_PX;

  // A shared class renders once, full width, from my side — so their copy is
  // filtered out rather than drawn underneath.
  const mySharedIds = new Set(
    mine.filter((a) => theirs.some((b) => isSameClass(a, b))).map((a) => a.id)
  );
  const theirSharedIds = new Set(
    theirs.filter((b) => mine.some((a) => isSameClass(a, b))).map((b) => b.id)
  );

  const mineBlocks = computeLayout(mine, [selectedDay], axis);
  const theirBlocks = computeLayout(theirs, [selectedDay], axis);

  return (
    <>
      <DaySelector days={days} selected={selectedDay} onSelect={setSelectedDay} />

      <div className="flex px-4 pb-6">
        <div className="w-12 shrink-0">
          {hours.map((minute, i) => (
            <div key={minute} className="relative" style={{ height: HOUR_HEIGHT_PX }}>
              {i < hours.length - 1 && (
                <span className="absolute -top-2 right-2 text-[10px] text-slate-400">
                  {formatHourLabel(minute)}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="relative flex-1" style={{ height: gridHeight }}>
          {hours.map((minute) => (
            <div key={minute} className="border-t border-slate-200" style={{ height: HOUR_HEIGHT_PX }} />
          ))}

          {(freeByDay[selectedDay] ?? []).map((window) => (
            <div
              key={`${window.start}-${window.end}`}
              className="absolute inset-x-0 bg-emerald-100/60"
              style={{
                top: `${((window.start - axis.startMinute) / span) * 100}%`,
                height: `${((window.end - window.start) / span) * 100}%`,
              }}
            >
              <span className="absolute right-1 top-1 text-[10px] font-medium text-emerald-800">
                Both free
              </span>
            </div>
          ))}

          <div className="absolute inset-0">
            {mineBlocks.map((block) => {
              const shared = mySharedIds.has(block.meeting.id);
              const styles = CLASS_COLORS[block.meeting.color] ?? CLASS_COLORS.indigo;
              return (
                <div
                  key={`mine-${block.meeting.id}`}
                  className={`absolute overflow-hidden rounded-lg border px-1.5 py-1 ${styles.block} ${styles.text}`}
                  style={{
                    top: `${block.topPct}%`,
                    height: `${block.heightPct}%`,
                    left: 0,
                    width: shared ? '100%' : '50%',
                  }}
                >
                  <p className="truncate text-[11px] font-semibold leading-tight">
                    {shared ? `${block.meeting.name} · shared` : block.meeting.name}
                  </p>
                  <p className="truncate text-[10px] opacity-80">
                    {formatMinutes(block.meeting.startMinute)}
                  </p>
                </div>
              );
            })}

            {theirBlocks
              .filter((block) => !theirSharedIds.has(block.meeting.id))
              .map((block) => {
                const styles = CLASS_COLORS[block.meeting.color] ?? CLASS_COLORS.indigo;
                return (
                  <div
                    key={`theirs-${block.meeting.id}`}
                    className={`absolute overflow-hidden rounded-lg border px-1.5 py-1 ${styles.block} ${styles.text}`}
                    style={{
                      top: `${block.topPct}%`,
                      height: `${block.heightPct}%`,
                      left: '50%',
                      width: '50%',
                    }}
                  >
                    <p className="truncate text-[11px] font-semibold leading-tight">{block.meeting.name}</p>
                    <p className="truncate text-[10px] opacity-80">
                      {formatMinutes(block.meeting.startMinute)}
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <p className="px-4 pb-4 text-xs text-slate-500">
        Left lane: you. Right lane: @{theirUsername}. Full width: shared.
      </p>
    </>
  );
}
```

- [ ] **Step 3: Create the compare page**

```tsx
// src/features/compare/ComparePage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSchedule } from '@/features/schedule/useSchedule';
import { rowToMeeting, rowToProfile, type ClassRow, type ProfileRow } from '@/domain/mappers';
import { findSharedClasses, computeMutualFree } from '@/domain/compare';
import { WEEKDAYS } from '@/domain/constants';
import CompareGrid from './CompareGrid';
import CompareSummary from './CompareSummary';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import type { ClassMeeting, Interval, Profile } from '@/domain/types';

export default function ComparePage() {
  const { username } = useParams<{ username: string }>();
  const { session } = useAuth();
  const { classes: mine, loading: mineLoading } = useSchedule(session?.user.id);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [theirs, setTheirs] = useState<ClassMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, invite_code')
        .eq('username', username!)
        .maybeSingle();

      if (!profileRow) { setLoading(false); return; }
      const found = rowToProfile(profileRow as ProfileRow);
      setProfile(found);

      const { data: classRows } = await supabase
        .from('classes')
        .select('id, user_id, name, instructor, room, days, start_minute, end_minute, color, sort_order')
        .eq('user_id', found.id)
        .order('sort_order');

      setTheirs(((classRows ?? []) as ClassRow[]).map(rowToMeeting));
      setLoading(false);
    }
    void run();
  }, [username]);

  const days = useMemo(() => {
    const weekend = [6, 7].filter((d) =>
      [...mine, ...theirs].some((c) => c.days.includes(d))
    );
    return [...WEEKDAYS, ...weekend];
  }, [mine, theirs]);

  const shared = useMemo(() => findSharedClasses(mine, theirs), [mine, theirs]);

  const freeByDay = useMemo(() => {
    const map: Record<number, Interval[]> = {};
    for (const day of days) map[day] = computeMutualFree(mine, theirs, day);
    return map;
  }, [mine, theirs, days]);

  if (loading || mineLoading) return <Spinner label="Comparing schedules" />;
  if (!profile) return <EmptyState title="Not found" body="No student with that username." />;

  if (theirs.length === 0) {
    return <EmptyState title={`@${profile.username}`} body="They haven't added their schedule yet." />;
  }

  return (
    <main>
      <header className="px-4 pt-4">
        <h1 className="text-2xl font-bold">You and @{profile.username}</h1>
      </header>

      <div className="mt-4">
        <CompareSummary shared={shared} freeByDay={freeByDay} days={days} />
      </div>

      <div className="mt-4">
        <CompareGrid
          mine={mine}
          theirs={theirs}
          days={days}
          freeByDay={freeByDay}
          theirUsername={profile.username}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add the route**

```tsx
import ComparePage from '@/features/compare/ComparePage';

<Route path="/compare/:username" element={<RequireAuth><AppShell><ComparePage /></AppShell></RequireAuth>} />
```

- [ ] **Step 5: Verify**

With two connected accounts holding overlapping schedules, open `/compare/<their-username>` at 390×844.
Expected: the summary names the shared classes and lists mutual free windows per day; the grid shows your classes on the left, theirs on the right, shared classes full width with "· shared", and green "Both free" bands where neither has a class.

- [ ] **Step 6: Commit**

```bash
git add src/features/compare src/App.tsx
git commit -m "feat: add schedule comparison with shared classes and mutual free time"
```

---

# Phase 9 — Finish

### Task 19: Profile page, final routing and deploy

**Files:**
- Create: `src/features/auth/ProfilePage.tsx`
- Modify: `src/App.tsx`, `README.md`

- [ ] **Step 1: Create the profile page**

```tsx
// src/features/auth/ProfilePage.tsx
import { useAuth } from './AuthProvider';
import Button from '@/components/Button';

export default function ProfilePage() {
  const { profile, signOut } = useAuth();

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="font-semibold">@{profile?.username}</p>
        {profile?.displayName && <p className="text-sm text-slate-500">{profile.displayName}</p>}
      </div>
      <Button variant="secondary" onClick={() => void signOut()} className="w-full">Sign out</Button>
    </main>
  );
}
```

- [ ] **Step 2: Confirm the full route table in `src/App.tsx`, with route-level code splitting**

Every route except login and the schedule page is lazily loaded. Students arrive on cellular; there is no reason to ship the compare grid to someone who is only checking their own Tuesday.

```tsx
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import RequireAuth from '@/features/auth/RequireAuth';
import AppShell from '@/components/AppShell';
import Spinner from '@/components/Spinner';
import LoginPage from '@/features/auth/LoginPage';
import SchedulePage from '@/features/schedule/SchedulePage';

const OnboardingPage = lazy(() => import('@/features/auth/OnboardingPage'));
const ProfilePage = lazy(() => import('@/features/auth/ProfilePage'));
const UploadPage = lazy(() => import('@/features/upload/UploadPage'));
const FriendsPage = lazy(() => import('@/features/friends/FriendsPage'));
const FriendSchedulePage = lazy(() => import('@/features/friends/FriendSchedulePage'));
const InvitePage = lazy(() => import('@/features/friends/InvitePage'));
const ComparePage = lazy(() => import('@/features/compare/ComparePage'));

const shell = (element: ReactNode) => (
  <RequireAuth><AppShell>{element}</AppShell></RequireAuth>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
            <Route path="/invite/:code" element={<RequireAuth><InvitePage /></RequireAuth>} />
            <Route path="/" element={shell(<SchedulePage />)} />
            <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
            <Route path="/friends" element={shell(<FriendsPage />)} />
            <Route path="/profile" element={shell(<ProfilePage />)} />
            <Route path="/u/:username" element={shell(<FriendSchedulePage />)} />
            <Route path="/compare/:username" element={shell(<ComparePage />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Run the full verification pass**

Run: `npm test`
Expected: PASS — all domain test files green.

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

Run: `npx supabase db execute --file supabase/tests/rls_check.sql`
Expected: completes without raising.

- [ ] **Step 4: Write `README.md`**

````markdown
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
````

- [ ] **Step 5: Deploy**

Run: `npx vercel --prod`
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project settings, and add the production URL to the Supabase Google redirect list.

Expected: the deployed URL loads, Google sign-in completes, and upload → review → save → grid works on a real phone.

- [ ] **Step 6: Commit**

```bash
git add src README.md
git commit -m "feat: add profile page, finalize routing and document setup"
```

---

## Verification Checklist

Before calling this done, confirm each of these by running it:

- [ ] `npm test` — all domain tests pass
- [ ] `npm run build` — no TypeScript errors, and the entry chunk is under 200 KB gzipped in the reported chunk sizes (§5 cellular budget)
- [ ] `supabase/tests/rls_check.sql` — no leak, friends can read
- [ ] A non-friend cannot see another student's classes in the running app
- [ ] Upload works on a real phone over cellular, not just desktop DevTools
- [ ] With an invalid `GEMINI_API_KEY`, the manual-entry fallback still saves a schedule
- [ ] A class scheduled outside 08:00–18:00 is visible on the grid
- [ ] Bottom nav does not overlap content on an iPhone with a home indicator
- [ ] Tapping a form field on iOS Safari does not zoom the page
