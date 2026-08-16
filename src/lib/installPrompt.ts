// src/lib/installPrompt.ts
//
// Chrome on Android fires `beforeinstallprompt` once, early, and only if the
// page qualifies for installation (manifest + icons + HTTPS). If nobody calls
// preventDefault() on it the browser shows its own mini-infobar, and the
// event is gone by the time onboarding renders. So we intercept it at module
// load — this file is imported from main.tsx for that side effect — and hold
// it until the student reaches the "add to home screen" step.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });

  // Installed from the browser's own menu rather than our button: drop the
  // held event so we stop offering to do what has already been done.
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

export function subscribeToInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hasInstallPrompt(): boolean {
  return deferred !== null;
}

/**
 * Shows the browser's native install dialog. A deferred prompt may only be
 * used once, so it is cleared before use — a second tap falls back to the
 * written steps rather than throwing.
 */
export async function showInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';

  deferred = null;
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

/** True when the app is already running from a home-screen icon. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Non-standard, and the only signal iOS Safari gives us.
    (navigator as { standalone?: boolean }).standalone === true
  );
}
