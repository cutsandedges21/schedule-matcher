// src/features/auth/OnboardingPreview.tsx
import { useState } from 'react';
import AboutIntro from './AboutIntro';
import IntroQuestions from './IntroQuestions';
import {
  ALL_ANSWERS,
  BANDS,
  payoff,
  type Answers,
  type BandId,
} from '@/domain/onboardingQuestions';

/**
 * One answer set per payoff band, found by asking the real `payoff()` which
 * band each of the 27 combinations lands in.
 *
 * Derived, never written down. A hard-coded combination is a second copy of
 * the weights in onboardingQuestions.ts: retune one weight and the button
 * labelled `core` quietly starts opening the `manual` payoff, with nothing to
 * say so. A preview that shows the wrong screen is worse than no preview,
 * because you act on what it showed you.
 *
 * Bands with no representative are dropped rather than asserted into
 * existence. All four are reachable today; if a weight change ever made one
 * unreachable, a missing button is the honest signal — and the harness keeps
 * running, which a `!` blowing up at import time would not allow.
 */
interface BandSample {
  band: BandId;
  answers: Answers;
}

const BAND_SAMPLES: readonly BandSample[] = (Object.keys(BANDS) as BandId[])
  .map((band) => ({ band, answers: ALL_ANSWERS.find((set) => payoff(set).band === band) }))
  .filter((entry): entry is BandSample => entry.answers !== undefined);

/**
 * Where the preview currently is. `seed` is what makes band jumping possible:
 * a complete answer set opens IntroQuestions on its payoff, an empty one opens
 * it on question one.
 */
type Stage = { step: 'intro' } | { step: 'questions'; seed: Partial<Answers> };

const PROLOGUE: Stage = { step: 'intro' };
const QUESTIONS_FROM_SCRATCH: Stage = { step: 'questions', seed: {} };

/**
 * Dev-only harness for the whole onboarding flow: the prologue, the three
 * questions, and the payoff, played by the real `AboutIntro` and
 * `IntroQuestions` rather than by copies of them. Nothing here reimplements a
 * screen — a preview that drifts from the real thing tells you it is fine when
 * it is not.
 *
 * The problem it solves: onboarding mounts only while a signed-in user has no
 * `profiles` row, so looking at a copy or animation change otherwise costs you
 * your account. And there are four payoff bands behind 27 answer combinations,
 * so seeing one specific band meant remembering which three options lead there
 * and tapping them again on every reload.
 *
 * It loops — finishing the payoff restarts at the prologue — because the point
 * is to watch a thing more than once.
 */
export default function OnboardingPreview() {
  const [stage, setStage] = useState<Stage>(PROLOGUE);
  const [open, setOpen] = useState(false);
  /**
   * Remount key. Bumped on every jump, including a jump to where we already
   * are: re-picking the band you are looking at should replay its entrance
   * animation, which React will not do for a component it considers unchanged.
   */
  const [run, setRun] = useState(0);

  function go(next: Stage) {
    setStage(next);
    setRun((n) => n + 1);
    // Collapse, so the screen you just asked for is the screen you get to see.
    setOpen(false);
  }

  return (
    <>
      {stage.step === 'intro' ? (
        <AboutIntro key={run} onDone={() => go(QUESTIONS_FROM_SCRATCH)} />
      ) : (
        <IntroQuestions key={run} initialAnswers={stage.seed} onDone={() => go(PROLOGUE)} />
      )}

      {open ? (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 bg-slate-900/95 p-2 font-mono text-[10px] text-white"
          data-testid="preview-controls"
        >
          <div className="flex items-center gap-2">
            <span className="px-1 uppercase tracking-widest text-slate-400">dev preview</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-touch ml-auto rounded px-3 text-slate-300 underline underline-offset-2"
            >
              hide
            </button>
          </div>

          <div className="flex gap-2">
            <DevButton onClick={() => go(PROLOGUE)}>restart</DevButton>
            <DevButton onClick={() => go(QUESTIONS_FROM_SCRATCH)}>questions</DevButton>
          </div>

          <div className="flex gap-2">
            {BAND_SAMPLES.map(({ band, answers }) => (
              <DevButton key={band} onClick={() => go({ step: 'questions', seed: answers })}>
                {band}
              </DevButton>
            ))}
          </div>
        </div>
      ) : (
        /*
         * Collapsed by default, and deliberately not a 44px touch target — the
         * one thing this harness must not do is sit on top of the screen being
         * reviewed. 20px tall at 4px from the bottom puts it entirely inside
         * the 24px bottom padding every onboarding screen already has (`p-6`),
         * so it covers no copy, no photo, and not the payoff's Continue button.
         * Growing it to `min-h-touch` would put it straight through that
         * button; it is chrome you tap twice a session, not product UI.
         */
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-1 right-1 z-50 h-5 rounded-full bg-slate-900/70 px-2 font-mono text-[10px] leading-none text-white"
        >
          dev
        </button>
      )}
    </>
  );
}

/**
 * Monospace on near-black, nothing like anything else in the app. The founder
 * is here to judge a design, so the tools have to be unmistakably not part of
 * it.
 */
function DevButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-touch flex-1 rounded border border-slate-600 bg-slate-800 px-2 text-white"
    >
      {children}
    </button>
  );
}
