// src/components/Toast.tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Tone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

type ShowToast = (message: string, tone?: Tone) => void;

/** A no-op outside the provider, so a page rendered alone in a test still works. */
const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

const TOAST_MS = 3500;
const MAX_TOASTS = 3;

const TONES: Record<Tone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-slate-200 bg-white text-slate-900',
};

/**
 * Brief confirmation that an action landed — a task created, a vote counted.
 *
 * One polite live region for all of them, present from first render: a
 * region that is inserted together with its message is often not announced at
 * all, because assistive tech only watches regions that already exist.
 *
 * Sits above the bottom tab bar on a phone (bottom-24) and in the corner on a
 * desktop. Errors that need a decision belong inline next to the control, not
 * here — a toast disappears, and the student may not have read it yet.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback<ShowToast>(
    (message, tone = 'success') => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, tone }].slice(-MAX_TOASTS));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_MS)
      );
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${TONES[toast.tone]}`}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="-mr-2 flex min-h-touch min-w-touch items-center justify-center text-current opacity-60"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
