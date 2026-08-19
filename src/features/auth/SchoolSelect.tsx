// src/features/auth/SchoolSelect.tsx
import { useEffect, useRef, useState } from 'react';
import { SCHOOLS, schoolById } from '@/domain/schools';

interface Props {
  selectedId: string;
  onChoose: (id: string) => void;
}

/**
 * A listbox rather than a native `<select>`.
 *
 * A native select cannot show a colour on an option — `<option>` takes text and
 * nothing else on iOS — and the colour is most of what distinguishes one school
 * from the next here. So this keeps the rounded box and the per-row swatches
 * the section had when it was a flat list, and adds the one thing a list was
 * missing: it collapses to a single row, with a chevron saying so.
 *
 * Built to the ARIA listbox pattern, because rolling a menu means taking on
 * what the platform used to do for free: outside taps and Escape both close
 * it, and focus returns to the trigger afterwards so a keyboard user is not
 * dropped at the top of the document.
 */
export default function SchoolSelect({ selectedId, onChoose }: Props) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = schoolById(selectedId);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    }

    // `pointerdown` rather than `click`: a tap that starts outside and ends on
    // the list would otherwise both close the menu and select a row.
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function choose(id: string) {
    onChoose(id);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div ref={container} className="relative mt-2">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`School: ${selected.name}`}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-touch w-full items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium active:bg-slate-100"
      >
        <span
          aria-hidden
          className="h-5 w-5 shrink-0 rounded-full border border-black/10"
          style={{ backgroundColor: selected.accent }}
        />
        <span className="flex-1">{selected.name}</span>
        <span
          aria-hidden
          className={
            open
              ? 'shrink-0 text-base text-slate-500 rotate-180 transition-transform'
              : 'shrink-0 text-base text-slate-500 transition-transform'
          }
        >
          ▾
        </span>
      </button>

      {open && (
        // Overlaid rather than pushing the page down, so opening the menu does
        // not shove every section below it out from under the reader's thumb.
        <ul
          role="listbox"
          aria-label="School"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-lg"
        >
          {SCHOOLS.map((school, index) => {
            const isSelected = school.id === selectedId;
            return (
              <li key={school.id} className={index > 0 ? 'border-t border-slate-200' : undefined}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(school.id)}
                  className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium active:bg-slate-100"
                >
                  <span
                    aria-hidden
                    className="h-5 w-5 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: school.accent }}
                  />
                  <span className="flex-1">{school.name}</span>
                  {isSelected && (
                    <span aria-hidden className="font-bold text-accent">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
