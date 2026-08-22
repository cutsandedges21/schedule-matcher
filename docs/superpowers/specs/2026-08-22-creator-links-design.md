# Creator links on Settings

## What

A new section on the Settings page (`src/features/auth/SettingsPage.tsx`) crediting the
operator and linking out to three of his other projects: LifeOS, Summit Sites, and Cuts &
Edges. This is a promotional add — nothing here is functionally required by the app.

## Placement and prominence

Inserted as its own `<section>` between "Legal" and the "Sign out" button — grouped with the
other read-only/navigational sections rather than mixed into account actions.

Deliberately a notch more visible than "Legal" and "Appearance":

- Heading uses `text-sm font-bold text-slate-900` instead of the muted
  `text-sm font-semibold text-slate-500` every other Settings heading uses.
- The card wrapping the rows uses a 2px `border-accent` instead of the plain
  `border border-slate-200` Legal/Appearance use. This reuses the school accent colour
  system already driving buttons and active nav state — no new colour is introduced.

Heading copy: **"More from me"**, with a one-line casual intro underneath: *"I also run a few
other things outside of class:"*

## Rows

Three rows in the same rounded-2xl bordered-card-with-dividers pattern as Legal, but each
carries a one-line description under the name (Legal's rows do not — this is new to
`NavRow`). Copy is grounded in what's actually live on each site as of 2026-08-22 (checked by
loading each URL, not guessed):

| Name | URL | Description |
|---|---|---|
| LifeOS | `https://lifeos-daily.vercel.app` | Habits, health, and money — my daily operating system |
| Summit Sites | `https://summit-sites.vercel.app` | Web design for businesses across Canada |
| Cuts & Edges | `https://cutsandedges.vercel.app` | Lawn care in RDP, Anjou & Saint-Léonard |

All three are external links: `target="_blank" rel="noopener noreferrer"` (the `rel` is a
security necessity — without it the opened tab can reach back into `window.opener`). The row's
trailing glyph is `↗` instead of the `›` chevron internal `NavRow`s use, so it's visually clear
before tapping that the row leaves the app rather than navigating within it.

## Component change

`NavRow` (currently local to `SettingsPage.tsx`) gains two optional props: `href` (external,
mutually exclusive with the existing `to`) and `description`. When `href` is set it renders an
`<a>` instead of a `<Link>` and swaps the glyph. When `description` is set, the label sits above
a `text-xs text-slate-500` subtitle line inside a `flex flex-col`; when absent, rendering is
unchanged from today (Legal/Appearance rows keep their current single-line look — this is a
non-breaking addition, not a rewrite).

## Out of scope

- No icons/logos per project — text only, matching the app's existing minimalism.
- No tracking/analytics on these link clicks.
- No i18n — Settings is English-only today, same as every other authenticated screen (only
  the legal pages are bilingual).
