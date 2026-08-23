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

  useEffect(() => {
    // Remember what opened the sheet so focus can go back on close, rather
    // than falling to the top of the document.
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
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
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/40"
        onClick={onClose}
        aria-hidden="true"
        data-testid="sheet-backdrop"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={value.name ? `Edit ${value.name}` : 'Add a class'}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-rose-600">
            Delete
          </Button>
          <p className="truncate px-2 text-sm font-semibold">{value.name || 'New class'}</p>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>

        <div className="p-3">
          {/* No onRemove: deletion is in the header above. */}
          <ClassCard index={0} value={value} onChange={onChange} />
          <Button onClick={onDone} className="mt-3 w-full">
            Done
          </Button>
        </div>
      </div>
    </>
  );
}
