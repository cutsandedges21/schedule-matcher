# Monetization

Date: 2026-08-17

How Schedule Matcher makes money without strangling the thing that makes it
work.

The product is a network good. A schedule with no friends attached to it is
worth nothing; value is created by the *second* and *third* person to join, not
the first. Every design decision below follows from that single fact, so it is
worth stating the governing rule before anything else:

> **Anything that grows the network is free forever. Only power usage is paid.**

A monetization decision that violates that rule is wrong even when it makes
money in the short term, because it costs more later than it collects now.

---

## 1. Position and timing

**Ambition:** meaningful side income first, with the option to become something
larger. That ordering matters — it rules out extracting revenue before the
network exists.

**Ruled in:** students paying directly; local-business sponsorship, later.
**Ruled out:** programmatic ads (pays ~$1–3 CPM, makes a design-led app feel
cheap) and institutional sales (contracts too slow, and requires being a real
entity).

**Ship schedule:**

| Phase | When | What |
|---|---|---|
| 0 | Fall 2026 term | Ship free. Monetize nothing. Instrument everything. |
| 1 | January 2027 term | Launch the Pass. |
| 2 | One campus > ~1,000 users | Reconsider local-business sponsorship. Out of scope here. |

Phase 0 exists because **you cannot measure demand for a wall that does not
exist**, and because a CEGEP is a closed social world of ~10,000 people where
the first impression is the only one. An app that arrives feeling like a
paywall burns the whole school, and that is not recoverable within a student
generation.

The Phase 0 deliverable is therefore *instrumentation*, not payment code. See
§6.

---

## 2. Price

Two SKUs, sold side by side:

| SKU | Price | `pass_tier` |
|---|---|---|
| Semester pass | $3.99 | `term` |
| Forever unlock | $6.99 | `lifetime` |

The forever unlock pays for itself in **1.75 terms** and a CEGEP student is
enrolled for four to six. So most people who convert will take the $6.99, and
the $3.99 earns its place as the anchor that makes $6.99 read as obviously
correct — while remaining the honest choice for someone graduating in May.

**Neither SKU auto-renews.** The semester pass is a manual repurchase. Three
reasons, in order of weight:

1. Quebec contracts with minors are voidable and the Consumer Protection Act
   treats auto-renewal strictly. A large share of CEGEP students are 16–17.
   A one-shot purchase sidesteps the entire question.
2. Expiry becomes an upsell moment rather than a churn event: *"Renew for
   $3.99, or never think about this again for $6.99."*
3. No failed-payment emails, no cancellation requests, no dunning. At two
   founders and this revenue scale, support burden is a real cost.

### 2.1 Why not a monthly subscription

The original instinct was ~$1/month. It is the wrong *shape*, independent of
the number:

- **Demand is violently seasonal** — late August and early January, troughs
  otherwise. Monthly billing charges twelve times a year for value delivered
  twice. Students notice, and it breeds resentment toward the brand.
- **Stripe's 30¢ fixed fee is 30% of a $1 charge.** On $6.99 it is ~6%.
  Small recurring charges are the worst thing to route through a processor.
- **The math never worked.** At 3,000 users and a 2% conversion — an
  optimistic outcome for one campus — $1/month is $60/month gross, before
  churn, split two ways.

Being a PWA is a structural advantage worth protecting here: no App Store, no
Play Store, no 30% cut. Net is ~94% of $6.99. Any move to native would hand
away a third of the revenue.

---

## 3. The free/paid boundary

### 3.1 Free, permanently, no asterisk

- Signup, onboarding, school theme
- Schedule upload, extraction (3/term — see §4), manual correction, own grid
- **Unlimited friends**
- **Unlimited 1:1 compare** (`/compare/:username`)
- Group compare with **up to 2 friends**

The two bolded items are the viral loop. They are never gated, at any price,
in any future version.

### 3.2 Behind the Pass

| # | Feature | Why it is safe to charge for |
|---|---|---|
| 1 | **Cosmetics visible to friends** (§5) | Blocks nobody from anything. Markets itself. |
| 2 | **Group compare, 3–5 friends** + saved, named groups | Scales with the buyer's own social load, not the network's size |
| 3 | **Extraction headroom** (15/term) + past-semester archive + work-shift layer | Cost-aligned: the only feature with real marginal cost funds itself |
| 4 | **Free-window alerts** — *"You and Alice both have a 2-hour gap Thursday at 1:30"* | Recurring value delivered in the trough months |

**Group compare uses an organizer-pays, group-sees mechanic.** The buyer
assembles the group; all five people see the full result. This matters because
the students who want five-way groups are social hubs, and social hubs are
distribution — taxing them directly would tax growth. Instead the other four
get the complete experience free and hit the wall only when they try to
organize something themselves. The paywall becomes a live demo delivered by
your most connected users.

`MAX_GROUP_FRIENDS = 5` in `src/domain/constants.ts` is unchanged. The free
tier introduces a second, lower bound at 2.

### 3.3 Never monetize these

- **Friend count.** Ever.
- **1:1 compare.** Ever.
- **Basic schedule upload.** A user who cannot get their schedule in is worth
  $0 forever, and so are the friends they would have brought.
- **Class-block colours.** `colorForClass()` hashes the course name so the same
  class renders the same colour for every student. That *is* the comparison
  mechanic — it is the reason shared classes are visible at a glance. Selling
  custom block colours would monetize by breaking the feature people came for.
  Cosmetics stay at profile level. This is already documented in the README and
  is repeated here because it is the most tempting wrong idea in the space.

---

## 4. Extraction limits

| Tier | Limit |
|---|---|
| Free | **3 per term** |
| Pass | **15 per term** |

**Only successful extractions count against the quota.** A Gemini error, a
timeout, or a garbage result is free and retryable.

That rule matters more than either number. The failure mode of a tight quota is
not an annoyed user, it is a user who never onboards at all — first uploads
routinely fail on cropped screenshots, dark-mode screenshots, and rotated
photos. Losing that student also loses their share of the friend graph. Retries
must stay cheap and unlimited until something actually saves.

### 4.1 Why the paid tier is capped rather than unlimited

Not for unit economics. Flash-tier vision pricing puts an extraction on the
order of **$0.002**, so a $6.99 lifetime user would need roughly **3,500
extractions** to consume what they paid. Even an estimate off by 10x leaves the
conclusion intact: real-user extraction volume cannot lose money.

The 15/term cap exists solely to **bound scripted abuse**. No genuine student
will ever reach it, so it markets as unlimited while staying bounded.

### 4.2 The actual constraint today

The live limit is not dollars, it is **requests per day per key**. The Edge
Function runs a three-key free-tier pool (`GEMINI_API_KEYS`) advancing only on
429, because the free tier meters per key and uploads bunch hard at term start.

That is a term-start burst problem and the fix is to move one key to paid
billing before Phase 1 — not to squeeze paying customers. Verify actual pricing
against the deployed model before relying on the numbers in §4.1.

---

## 5. Cosmetics — the primary paid surface

A Pass holder picks a cosmetic, and **their friends see it on their friends
list**, in place of today's plain white card with a username.

This is the most important feature in the document, for three reasons:

1. **Cosmetics only the buyer can see have near-zero willingness-to-pay.
   Cosmetics other people see are the entire basis of the category** — Discord
   Nitro, Snapchat, every game skin ever sold. Visibility to others *is* the
   product.
2. **It is advertising you get paid for.** Every friend scrolling the list
   learns the Pass exists, from a peer, at zero marketing cost. That is a
   better growth flywheel than the group-compare paywall.
3. **It taxes nothing.** Unlike every other paid feature, nobody is blocked
   from any function. It is the only surface here with no downside risk to the
   network.

### 5.1 Curated presets, not a colour picker

Ship ~10 hand-picked presets. Not a free hex input.

- `schools.test.ts` already enforces 4.5:1 contrast for every school colour.
  User-chosen hex drives straight through that guarantee, and somebody will
  pick white-on-white. Presets are checkable in the same test.
- Presets can be **drip-fed** — a new one each term keeps the Pass feeling
  alive long after purchase, which is the main weakness of a lifetime unlock.
- Taste is preserved. The app's visual identity survives.

### 5.2 Collision with `SchoolChip`

A friend's card already renders their school in *their* colours via
`SchoolChip`. A cosmetic on the same card must not fight it. Division of
responsibility: **the cosmetic owns the card's border and background; the
school chip is untouched.** Any preset must be legible behind an arbitrary
school chip, which is a second constraint the preset test should cover.

Note the existing trap documented in `src/domain/color.ts` and the README:
never build these class names by interpolation. Tailwind's JIT scanner cannot
see them and drops the styles silently.

---

## 6. Phase 0 — what to build this fall

The Pass ships in January. Fall's entire job is to replace guesses with
numbers, and it is small.

Let group compare run free to all 5 this term — **but log the group size every
time**. In January that yields the exact share of users who would have hit a
2-friend cap, which is the single input that sets the conversion estimate.

Four things to track, all aggregate:

1. **Extractions per user per term.** `extraction_log` already captures this;
   confirm it is queryable by term.
2. **Group compare size distribution.** ← sets the conversion estimate
3. **Friend-graph density per school** (median friends per user)
4. **Week-1 → week-4 retention**

---

## 7. Phase 1 — payment mechanics

Deliberately minimal. This should be a day of work.

- **Stripe Checkout**, not a custom card form. Two price IDs.
- Webhook → Edge Function → set `profiles.pass_tier` and
  `profiles.pass_expires_at`.
- Schema: `pass_tier text not null default 'none'` (`'none' | 'term' |
  'lifetime'`) and `pass_expires_at timestamptz null`. `lifetime` ignores the
  expiry.
- RLS: `pass_tier` is readable by the owner and by accepted friends (friends
  need it to render cosmetics — see §5). It is **never** client-writable; only
  the webhook's service role sets it.

Term boundaries are fixed dates, not computed: Fall runs August–December,
Winter January–May.

---

## 8. Blocking prerequisites

None of this can take money until these are done.

### 8.1 Legal page placeholders

In `src/features/legal/LegalLayout.tsx`, plus a `LAST_UPDATED` bump:

| Placeholder | Value |
|---|---|
| `OPERATOR_NAME` | Mossimo Bianco |
| `CONTACT_EMAIL` | dedicated address, to be created |
| `JURISDICTION` | Quebec — *"the laws of the Province of Quebec and the federal laws of Canada applicable therein"*, courts in the judicial district of Montreal |

**`OPERATOR_NAME` is one person on purpose.** That field names who is legally
accountable for the service and the data it holds. Andreas Retsinas
contributed the idea and is credited as a founder, but listing him as operator
would attach real privacy-law obligations to someone who is not operating
anything. Credit belongs in About; the legal operator field is not credit.

`CONTACT_EMAIL` must not be a personal address, and **must be monitored** —
privacy law obliges an actual response to data requests.

~~Also outstanding: `public/about/team-placeholder.svg` still says on its face
that it is a placeholder.~~ Done — replaced by a real founder photo,
`public/about/intro-us.jpg`.

### 8.2 To investigate — not legal advice

Two items that genuinely apply and need a qualified answer:

1. **Quebec Law 25** (formerly Bill 64), fully in force. Applies to private
   enterprises handling Quebec residents' personal information — **from launch,
   not from first payment.** An earlier draft filed this under "before it is a
   paid service", which was wrong: the trigger is collecting the data, and this
   app stores class schedules and a friend graph belonging partly to minors on
   day one. Requires a designated **Privacy Officer** — defaulting to the
   operator — plus plain-language policies, breach notification, and data
   portability.
2. **Bill 96 / Charter of the French Language.** Commercial services offered to
   Quebec consumers generally need French availability, and the obligation
   sharpens once payment is involved.

### 8.3 A note on French, which is strategy and not only compliance

Dawson, Vanier, John Abbott and Marianopolis are English CEGEPs and account for
roughly 30–40k students. There are ~175,000 CEGEP students in Quebec, and the
large majority attend French institutions — Vieux Montréal, Ahuntsic,
Maisonneuve and the rest are absent from `src/domain/schools.ts` entirely.

French support is approximately a **4x market expansion wearing a compliance
costume**. It is out of scope for this document, and it is probably the
highest-leverage item on the roadmap after launch.

---

## 9. Founder revenue split

Not equity. There is no company. This governs how money that arrives is
divided, which makes it far easier to revisit without anyone feeling diluted.

**70/30, Mossimo/Andreas**, reflecting that one founder built and will continue
to operate the entire product.

The number matters less than the three mechanics around it:

- **Roles are written down per term.** Mossimo: product, engineering, infra.
  Andreas: growth, against a countable target — installs at his campus by a
  named date — plus socials and support triage.
- **A checkpoint at end of fall term, with the outcomes agreed in advance.**
  Growth targets hit → moves toward 60/40. Nothing delivered → 85/15 or exit.
- **A fade clause.** If either founder goes inactive, their share of *future*
  revenue drops after ~90 days. Past payouts are never clawed back.

Two observations that should temper the whole conversation. An idea alone
carries very little value, because ideas are abundant and execution is not — a
50/50 split between an idea and an entire operated product is not stable and
tends to detonate when real money first appears. But **hours worked to date is
a weak anchor in the other direction**: roughly 0% of what determines whether
this succeeds has happened yet. There are zero users. Getting 500 CEGEP
students through an iOS add-to-home-screen flow is harder than what has been
built so far, and it is unbuilt.

So the split is forward-looking by construction: it prices *roles going
forward*, not work already done.

**Settle it in writing while the number is still zero.** It is a twenty-minute
conversation at $0 and the end of a friendship at $400/month.

---

## 10. Open questions

- Exact fall-term launch date, which sets the Phase 0 measurement window.
- Which of the four paid features ships first in January. The instrumentation
  in §6 is meant to answer this; cosmetics (§5) is the current favourite on
  reasoning alone.
- Whether one Gemini key moves to paid billing before or after the fall burst.
