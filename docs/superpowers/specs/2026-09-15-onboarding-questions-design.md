# Onboarding: questions instead of slides

Date: 2026-09-15

Replaces the back half of the onboarding intro with three questions and a
payoff assembled from the answers.

The intro today is four auto-playing beats, 14 seconds, with no next, no back,
no skip, and no response to a tap. `slideshow.ts` calls that a sentence rather
than a ceiling, and says the fix is letting a tap advance. Questions do that as
a side effect: the sequence now runs at the student's thumb speed.

**Beats 1 and 2 are kept exactly as they are.** They establish the problem and
they do it with a real screenshot, which is the strongest evidence in the app.
Beats 3 and 4 — the solution slide and the founder slide — are replaced.

## 1. Shape

```
beat 1  "Every semester, this exact conversation."        (unchanged, auto-play)
beat 2  "Everyone sends a screenshot. Nobody gets an answer."  (unchanged, auto-play)
Q1      who                                                (tap to advance)
Q2      how it goes                                        (tap to advance)
Q3      what it costs                                      (tap to advance)
payoff  recap -> headline -> body -> bridge -> photos -> signoff
username
```

The founder beat is not deleted, it is **merged into the payoff**. Its four
photos and its line now close the payoff screen. Credibility lands at the
moment the student has just finished describing the problem in their own words,
which is the strongest placement available for it.

## 2. The questions

Three, in this order. Each advances on tap; there is no Next button and no
free-text input anywhere.

### Q1 — who

> **Three questions. How many people are you usually making plans with?**

| Option | `value` | weight | fragment |
|---|---|---|---|
| Me and one friend | `one` | 0 | You and one friend. |
| Three or four of us | `few` | 1 | Three or four of you. |
| The whole group chat | `chat` | 2 | The whole group chat. |

The stem asks literally what the options answer. An earlier draft read "Who has
to be free before plans happen?", which is a sentence you have to parse before
you can answer it — wrong for a 17-year-old on a phone thirty seconds into an
app they just installed.

### Q2 — how it goes

> **Someone asks when everyone's free. Then what?**

| Option | `value` | weight | fragment |
|---|---|---|---|
| We sort it out | `sorted` | 0 | You sort it out. |
| Someone's always busy | `busy` | 1 | Someone always turns out to be busy. |
| Screenshots, then silence | `silence` | 2 | Screenshots go in, nothing comes back. |

`silence` hands beat 2's own scene back to the student as something to tap.
The seam between the last slide and the first question is the defect this
avoids.

### Q3 — what it costs

> **Last one. What does that cost you?**

| Option | `value` | weight | fragment |
|---|---|---|---|
| Two minutes | `minutes` | 0 | Two minutes, tops. |
| Half an hour, easy | `halfhour` | 1 | Half an hour, every time. |
| The plan itself | `plan` | 2 | The plan doesn't happen. |

"Three questions." on Q1 and "Last one." on Q3 cost two words and set a finite
expectation the 14-second auto-play never gave anyone.

### The weight rubric

One rubric, applied three times: **0 costs nothing, 1 is real friction that
still resolves, 2 is failure.** Uniformity across the three questions is what
makes summing them mean anything. A per-question scale would make the total
arbitrary.

## 3. Composing the payoff

A pure function. No branching on any individual answer.

```ts
type Answers = {
  who: 'one' | 'few' | 'chat';
  how: 'sorted' | 'busy' | 'silence';
  cost: 'minutes' | 'halfhour' | 'plan';
};

payoff(a: Answers): {
  score: number;      // 0..6
  band: BandId;       // 'clear' | 'edge' | 'manual' | 'core'
  recap: string;
  headline: string;
  body: string;
  bridge: string;     // constant
  signoff: string;    // constant
}
```

**Score.** `W.who[a.who] + W.how[a.how] + W.cost[a.cost]`, an integer 0–6.

**Recap.** The three chosen fragments joined with a space. Every fragment is a
complete, sentence-cased sentence ending in a period and is self-contained — no
fragment opens with a conjunction — so no ordering can produce a non-sequitur.
The join is the only string operation performed on them.

**Band.** First match in a frozen ascending table:

| `max` | id | combinations |
|---|---|---|
| 0 | `clear` | 1 |
| 2 | `edge` | 9 |
| 4 | `manual` | 13 |
| 6 | `core` | 4 |

The final `max` equals the maximum possible score, so the scan is total and
there is no fallback branch to leave untested. Band sizes follow the trinomial
(1 + x + x²)³ = [1, 3, 6, 7, 6, 3, 1]; all four bands are reachable.

**Answers are never stored.** They live in one `useState` object inside the
question component, are passed to `payoff()` at render, and are discarded when
the component unmounts. No Supabase write, no `localStorage`, no analytics
event, no profile column. This is deliberate and it is why this feature needs
no migration and raises no Law 25 question: nothing new is collected.

## 4. The payoff copy

Render order: **recap** (body type, top) → **headline** (large) → **body** →
**bridge** → the four candid photos from the old beat 4 → **signoff**.

### `clear` — score 0

> **Nothing about that is broken.**
>
> You've got the easy version, and it still costs you two minutes.
>
> Screenshot your schedule once and fix anything it reads wrong. Your friend
> does the same. After that the hours you're both free are just there. When
> someone in the chat asks, you're the one who already knows.

Exactly one answer set reaches this band, which is what makes the singular
"your friend" provably safe here and nowhere else. Nothing in it diagnoses a
problem. A student who just said their setup works is not told they are
secretly suffering; they are offered a future moment instead.

### `edge` — score 1–2

> **You don't need a system for this.**
>
> You need your week saved somewhere your friends can see it.
>
> Screenshot your schedule once and fix anything it reads wrong. They do the
> same. After that the hours you're all free are already worked out. Nothing to
> send to the chat.

The headline is the app declining to sell them a system, which cannot insult a
student who has just said theirs is fine. This band deliberately names **no**
failure mechanism, because it is reachable by answer sets that deny every
individual mechanism — including *(whole group chat / we sort it out / two
minutes)*, where a scolding middle band would be flatly wrong.

### `manual` — score 3–4

> **You've been doing that part by hand.**
>
> None of that is hanging out. It's the part before hanging out.
>
> Screenshot your schedule once and fix anything it reads wrong. Everyone you
> add does the same. After that: every hour all of you are free, and the
> classes you have in common, on one screen.
>
> Making a plan becomes opening the app.

"By hand" is true of every student not already using this app, including one
who said picking a time is quick — quick and manual are not in conflict, and
the line makes no claim about duration. This band is reachable by a pair, so
the copy says "all of you" and the contradiction table forbids "the group"
here.

### `core` — score 5–6

> **You just described why this exists.**
>
> That's not you being bad at planning. It's a pile of schedules and no way to
> lay them on top of each other.
>
> Screenshot yours once and fix anything it reads wrong. Up to five friends do
> the same. After that there's nothing to work out — the free hours are already
> there, with the classes you share highlighted.
>
> Making a plan becomes opening the app.

A score of 5 is unreachable without at least two weight-2 answers, so every
student here reported two outright failures and the headline is literally true.
The middle line is a structural diagnosis rather than an emotional one, so it
holds for the student whose cost is half an hour as well as the one whose plans
die. It never asserts how they feel. "Up to five friends" matches
`MAX_GROUP_FRIENDS` in `src/domain/constants.ts`.

### Bridge and signoff — constant in all four bands

> You worked that out. I just added it up.
>
> *(four photos)*
>
> I'm Mossimo. I got tired of asking, so I built this.

The bridge is load-bearing. Its "I" is the same "I" that says "I'm Mossimo" one
line later, so the founder line arrives as the next sentence of a thought
rather than as a credit. Without it the sign-off reads as bolted on, which is
the failure mode of merging it into the payoff at all.

Both strings are byte-identical across bands, asserted by test.

## 5. The truth rule, made mechanical

The governing constraint: **every reachable combination must produce a payoff
that is true for that student.** A lie in the first thirty seconds is the same
bait-and-switch the monetization design refuses elsewhere.

Enforced by construction and then by test:

1. **Answer-specific language may appear only in fragments.** Fragments are
   verbatim restatements of what the student tapped, so they are true by
   construction.
2. **Band copy may assert only** product facts, and total coordination cost
   implied by the score. It may never name a failure mechanism attributable to
   one question, because every band above `clear` is reachable by answer sets
   that deny that mechanism.
3. **A `DENIES` table** maps each option to phrases it forbids:

   | option | forbids |
   |---|---|
   | `who.one` | "five of you", "the group", "everyone in the chat" |
   | `how.sorted` | "takes forever", "you're stuck", "nobody answers" |
   | `cost.minutes` | "drowning", "never happens", "hours" |

   A test asserts that for all 27 combinations, `headline + body + bridge`
   contains none of the phrases denied by any chosen answer. This is the
   executable form of the constraint, and it is what fails when someone later
   edits a lie into the copy.

## 6. Files

**New — `src/domain/onboardingQuestions.ts`.** Questions, options, weights,
fragments, the band table, `DENIES`, and `payoff()`. Pure, no React, no
Supabase import. Lives in `domain/` because that is the directory the vitest
config covers, and this is exactly the kind of table worth a test.

**New — `src/features/auth/IntroQuestions.tsx`.** Holds the `Answers` state,
renders one question at a time, then the payoff. Owns no copy of its own.

**Changed — `src/domain/slideshow.ts`.** `ABOUT_BEATS` drops to the first two
entries. `SEQUENCE_DURATION` falls from 14s to 7s, and the comment about
compulsory time should be updated to say the auto-playing part is now a
prologue rather than the whole intro.

**Changed — `src/features/auth/AboutIntro.tsx`.** Unchanged in behaviour; it
plays whatever is in `ABOUT_BEATS` and calls `onDone`.

**Orphaned — `public/about/overlap.svg`.** Beat 3 was its only reference, and
the payoff screen uses the four photos rather than an illustration. Delete it
with the change rather than leaving an asset nothing points at. `real-proof.jpg`,
`problem.svg` and `us-1.jpg`–`us-4.jpg` are all still used.

**Changed — `src/features/auth/OnboardingPage.tsx`.** The step union at line 54
gains a member: `'install' | 'intro' | 'questions' | 'username'`. `afterIntro`
advances to `questions` instead of `username`.

## 7. Tests

**`onboardingQuestions.test.ts`** — the cartesian product of 3×3×3, generated
rather than hand-listed:

- Every combination returns one of exactly four bands; `score` in 0–6.
- `recap` splits into exactly three non-empty sentences, contains all three
  chosen fragments in who/how/cost order, and none of the six unchosen ones.
- Band is monotonic in score: sorted by score, the sequence is
  `clear* edge* manual* core*` with no interleaving. Boundaries pinned at
  0→`clear`, 2→`edge`, 3→`manual`, 5→`core`.
- `band === 'clear'` implies all three zero-weight answers. This is what
  licenses the singular "your friend".
- `band === 'core'` implies at least two weight-2 answers. This is what
  licenses "you just described why this exists".
- The `DENIES` assertion, over all 27.
- Every fragment ends in a period; no fragment starts with "And" or "But";
  every option label is ≤ 25 characters.
- `bridge` and `signoff` are identical across all four bands.
- The module imports nothing from `@/lib/supabase` and calls no storage API.
- A snapshot of all 27 rendered payoffs, so any later copy edit is reviewed
  against every reachable student rather than against one the author had in
  mind.

**`slideshow.test.ts`** — one existing assertion breaks on purpose. Line 14,
"is the four beats the design calls for", becomes two beats. The budget
assertion at line 90 (≤ 20s) still passes and is worth keeping: it now bounds
the prologue rather than the whole intro.

## 8. Out of scope

- Storing answers. Reconsider only with a reason that survives Law 25.
- Back navigation between questions. Three taps forward; a back button on a
  screen with no wrong answers is weight without purpose.
- Skipping the questions. They are the intro now.
- Translating the payoff to French. Real, and it belongs with the wider French
  work rather than bolted onto this.
