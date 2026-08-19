// src/features/auth/SwatchPicker.tsx
import type { ReactNode } from 'react';

export interface SwatchOption {
  /** null is the "None" choice, stored as null in the column. */
  id: string | null;
  name: string;
  /** What the swatch shows — ideally the real thing, not an approximation. */
  preview: ReactNode;
}

interface Props {
  title: string;
  description: string;
  options: readonly SwatchOption[];
  selectedId: string | null;
  onChoose: (id: string | null) => void;
  error: string | null;
  /**
   * 4 for swatches that need to show a whole card, 8 for a hue wheel where each
   * cell is only a colour. At 8 a cell is ~34px wide, under the 44px touch
   * target — the button stays 44px tall and the row gaps absorb the miss, which
   * is the same trade the day chips in the schedule grid already make.
   */
  columns?: 4 | 8;
}

/**
 * One row of cosmetic swatches with radio semantics. Shared by all three
 * pickers in Settings so that a colour, a banner and an effect are chosen the
 * same way.
 *
 * The selection ring uses `ring-accent` — the *viewer's* own school. That is
 * correct here and only here: Settings is the one screen where the colours on
 * display belong to the person looking at them. Everywhere a friend's
 * cosmetics are drawn, they go through inline styles instead.
 *
 * `ring-offset-slate-50` matches the page background. Left at its default the
 * offset renders white, which shows as a halo on the slate-50 page.
 */
export default function SwatchPicker({
  title,
  description,
  options,
  selectedId,
  onChoose,
  error,
  columns = 4,
}: Props) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-500">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>

      <ul
        role="radiogroup"
        aria-label={title}
        // Full literal class names, never interpolated — the JIT scanner
        // cannot see `grid-cols-${n}` and drops it silently (domain/color.ts).
        className={
          columns === 8 ? 'mt-2 grid grid-cols-8 gap-1.5' : 'mt-2 grid grid-cols-4 gap-2'
        }
      >
        {options.map((option) => {
          const selected = option.id === selectedId;
          return (
            <li key={option.id ?? 'none'}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.name}
                onClick={() => onChoose(option.id)}
                className="flex w-full flex-col items-center gap-1"
              >
                {/*
                  The radius lives here and the preview inside inherits it with
                  `rounded-[inherit]`, so a swatch's border curves with the
                  corner instead of being sliced flat by this element's
                  overflow clip.

                  Smaller radius on the dense grid: at 8 columns a cell is only
                  ~34px wide, and a 12px curve takes a visible bite out of each
                  corner of what should read as a square of colour.
                */}
                <span
                  className={
                    selected
                      ? columns === 8
                        ? 'block h-12 w-full overflow-hidden rounded-md ring-2 ring-accent ring-offset-2 ring-offset-slate-50'
                        : 'block h-12 w-full overflow-hidden rounded-xl ring-2 ring-accent ring-offset-2 ring-offset-slate-50'
                      : columns === 8
                        ? 'block h-12 w-full overflow-hidden rounded-md'
                        : 'block h-12 w-full overflow-hidden rounded-xl'
                  }
                >
                  {option.preview}
                </span>
                {/* A hue wheel's names are "Hue 210" and "Hue 225" — twenty-four
                    of those is noise, and the swatch already says everything.
                    The button keeps its aria-label, so nothing is lost to a
                    screen reader. */}
                {columns === 4 && <span className="text-[11px] text-slate-500">{option.name}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </section>
  );
}
