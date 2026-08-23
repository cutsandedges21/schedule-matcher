// src/features/schedule/ClassSheet.tsx
import { useEffect, useRef } from 'react';
import ClassCard from '@/features/upload/ClassCard';
import Button from '@/components/Button';
import type { ExtractedClass } from '@/domain/types';

interface Props {
  value: ExtractedClass;
  onChange: (next: ExtractedClass) => void;
  onDone: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * The mobile editor's bottom sheet: one class, whole, no scrolling.
 *
 * Not a native <dialog>. `showModal` is unimplemented in this project's jsdom,
 * so a native dialog could not be tested in the existing Vitest setup — hence
 * the modal affordances (focus move, focus trap, Escape, backdrop) are written
 * out by hand here.
 *
 * Deletion lives in this header rather than inside ClassCard: it is the 52px
 * that lets the card fit the sheet on a 390x844 screen.
 */
export default function ClassSheet({ value, onChange, onDone, onDelete, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  /**
   * The escape handler needs the current `onClose`, but must not make it an
   * effect dependency.
   *
   * `onClose` is an inline arrow in the parent, so it has a fresh identity on
   * every render — and the parent re-renders on every keystroke, because edits
   * flow up to the draft and back down. Depending on it tore the effect down
   * and set it up again mid-word, and both halves move focus: the cleanup
   * restores it to the block that opened the sheet, the setup puts it on the
   * panel. Either one blurs the input, and blurring an input is what dismisses
   * the on-screen keyboard — so a student could type exactly one character per
   * tap. Reading it from a ref keeps setup and teardown tied to the sheet
   * opening and closing, which is what they were always meant to track.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    // Remember what opened the sheet so focus can go back on close, rather
    // than falling to the top of the document.
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;

      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
    // Mount and unmount only: this is sheet-open/sheet-close setup, not
    // per-render work. See the onCloseRef note above.
  }, []);

  return (
    <>
      {/*
        Lighter than a usual scrim. The grid below the card is a live preview of
        the very edit being made, so dimming it to the usual /40 would obscure
        the thing worth watching.
      */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/20"
        onClick={onClose}
        aria-hidden="true"
        data-testid="sheet-backdrop"
      />
      {/*
        Anchored to the top, not the bottom. An on-screen keyboard takes the
        lower half of the screen, so a bottom sheet puts the fields being typed
        into directly behind it. Inverted, the card stays fully visible and the
        keyboard covers only the grid — which needs no interaction while typing.
      */}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        // The name is no longer displayed, but assistive tech still needs to
        // know which class this is.
        aria-label={value.name ? `Edit ${value.name}` : 'Add a class'}
        tabIndex={-1}
        className="fixed inset-x-0 top-0 z-50 max-h-[92dvh] overflow-y-auto rounded-b-2xl bg-white pt-[env(safe-area-inset-top)] shadow-2xl"
      >
        <div className="p-3">
          {/* No onRemove: deletion is the quiet action below the button row. */}
          <ClassCard index={0} value={value} onChange={onChange} />

          {/* px-2 insets the pair from the card's own edges. */}
          <div className="mt-4 flex items-center gap-3 px-2">
            <Button
              variant="secondary"
              onClick={onClose}
              className="flex-1 rounded-full border-slate-300 shadow-sm"
            >
              Cancel
            </Button>
            <Button onClick={onDone} className="flex-1 rounded-full shadow-md">
              Done
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="mt-1 w-full text-xs font-medium text-rose-600"
          >
            Delete class
          </Button>
        </div>
      </div>
    </>
  );
}
