// src/features/notifications/NotificationsProvider.tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { countUnread, syncReminders } from './api';

interface NotificationsValue {
  unread: number;
  /** Re-count now — after reading, dismissing, or any action that may notify. */
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue>({
  unread: 0,
  refresh: async () => {},
});

export function useNotifications(): NotificationsValue {
  return useContext(NotificationsContext);
}

/** Matches the reminder window's resolution well enough: a 24 h notice a few minutes late is still a day early. */
const POLL_MS = 60_000;
const REMINDER_SYNC_MS = 5 * 60_000;

/**
 * One unread count for the whole app, so the bell in the phone top bar and the
 * one in the desktop header (both mounted, one hidden by CSS) share a poll
 * instead of running two.
 *
 * Polls only while the tab is visible and re-counts the moment it becomes
 * visible again — a home-screen PWA spends most of its life suspended, and
 * waking up to a stale badge reads as broken.
 *
 * A failure (offline, or the server without migration 0016) leaves the count
 * at its last value rather than surfacing an error: the badge is a hint, and
 * every screen that actually needs notifications reports its own errors.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const ready = Boolean(session && profile);
  const [unread, setUnread] = useState(0);
  const lastSync = useRef(0);

  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      setUnread(await countUnread());
    } catch {
      /* keep the last known count — see the component comment */
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) {
      setUnread(0);
      return;
    }

    async function tick() {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastSync.current >= REMINDER_SYNC_MS) {
        lastSync.current = Date.now();
        await syncReminders();
      }
      await refresh();
    }

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    const onVisible = () => void tick();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [ready, refresh]);

  return (
    <NotificationsContext.Provider value={{ unread, refresh }}>{children}</NotificationsContext.Provider>
  );
}
