// src/components/ConfirmDialog.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Button from './Button';

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirm button red. For deleting, removing, leaving. */
  destructive?: boolean;
  /**
   * The student must type this exactly before confirm unlocks — for the
   * irreversible ones (deleting a whole space), where a stray tap on a
   * dialog that looks like every other dialog should not be enough.
   */
  requireText?: string;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

/**
 * Without a provider (a component test rendering one page on its own), fall
 * back to the browser's own dialog rather than throwing — the behaviour under
 * test is what happens after the answer, not the dialog's styling.
 */
const ConfirmContext = createContext<Confirm>((options) =>
  Promise.resolve(window.confirm(options.body ? `${options.title}\n\n${options.body}` : options.title))
);

export function useConfirm(): Confirm {
  return useContext(ConfirmContext);
}

interface Pending extends ConfirmOptions {
  resolve: (answer: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    []
  );

  function close(answer: boolean) {
    pending?.resolve(answer);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <Dialog options={pending} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

function Dialog({ options, onClose }: { options: ConfirmOptions; onClose: (answer: boolean) => void }) {
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState('');
  const locked = options.requireText !== undefined && typed.trim() !== options.requireText;

  useEffect(() => {
    // Remember what had focus so closing hands it back, and start on Cancel:
    // for a destructive dialog the safe answer should be the one Enter hits.
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose(false);
      return;
    }
    if (event.key !== 'Tab') return;
    // Keep Tab inside the dialog: it is modal, so nothing behind it is
    // reachable by pointer either.
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input');
    if (!focusable || focusable.length === 0) return;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose(false);
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.body ? bodyId : undefined}
        onKeyDown={onKeyDown}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {options.title}
        </h2>
        {options.body && (
          <p id={bodyId} className="mt-2 text-sm leading-relaxed text-slate-600">
            {options.body}
          </p>
        )}

        {options.requireText !== undefined && (
          <label className="mt-3 block text-sm text-slate-700">
            Type <span className="font-mono font-semibold">{options.requireText}</span> to confirm.
            <input
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 min-h-touch w-full rounded-xl border border-slate-300 px-3"
            />
          </label>
        )}

        <div className="mt-5 flex gap-2">
          <Button ref={cancelRef} variant="secondary" className="flex-1" onClick={() => onClose(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            className={`flex-1 ${options.destructive ? 'bg-rose-600 text-white active:bg-rose-700 disabled:bg-rose-300' : ''}`}
            disabled={locked}
            onClick={() => onClose(true)}
          >
            {options.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}
