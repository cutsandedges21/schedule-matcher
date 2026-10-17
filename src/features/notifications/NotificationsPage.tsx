// src/features/notifications/NotificationsPage.tsx
import { Link, useNavigate } from 'react-router-dom';
import { useAsyncData } from '@/lib/useAsyncData';
import { messageOf } from '@/lib/supabaseErrors';
import { relativeTime } from '@/domain/relativeTime';
import type { AppNotification } from '@/domain/spaceMappers';
import Button from '@/components/Button';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import { Card, Notice, PageHeader } from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { useNotifications } from './NotificationsProvider';
import { dismissNotification, listNotifications, markAllRead, markRead } from './api';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useNotifications();
  const list = useAsyncData(listNotifications, [], 'Could not load your notifications.');
  const items = list.data ?? [];
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);

  async function open(notification: AppNotification) {
    if (!notification.readAt) {
      list.setData((current) =>
        (current ?? []).map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      // Navigation should not wait on this; a failure only leaves it unread.
      void markRead([notification.id]).then(refresh, () => {});
    }
    if (notification.link) navigate(notification.link);
  }

  async function readAll() {
    const previous = list.data;
    const now = new Date().toISOString();
    list.setData((current) => (current ?? []).map((n) => (n.readAt ? n : { ...n, readAt: now })));
    try {
      await markAllRead();
      await refresh();
    } catch (caught) {
      list.setData(previous ?? []);
      toast(messageOf(caught, 'Could not mark everything as read.'), 'error');
    }
  }

  async function dismiss(notification: AppNotification) {
    const previous = list.data;
    list.setData((current) => (current ?? []).filter((n) => n.id !== notification.id));
    try {
      await dismissNotification(notification.id);
      await refresh();
    } catch (caught) {
      list.setData(previous ?? []);
      toast(messageOf(caught, 'Could not dismiss that.'), 'error');
    }
  }

  if (list.loading && !list.data) return <Spinner label="Loading notifications" />;

  const now = Date.now();

  return (
    <main className="flex flex-col gap-5 px-4 pb-6 pt-4">
      <PageHeader
        title="Notifications"
        actions={
          <>
            {unreadIds.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => void readAll()}>
                Mark all read
              </Button>
            )}
            <Link
              to="/settings/notifications"
              aria-label="Notification settings"
              title="Notification settings"
              className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-600 active:bg-slate-100"
            >
              <Icon name="settings" className="h-5 w-5" />
            </Link>
          </>
        }
      />

      {list.error && <Notice tone="warning">{list.error}</Notice>}

      {items.length === 0 && !list.error ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon name="bell" className="h-8 w-8 text-slate-300" />
          <p className="font-semibold">You are all caught up</p>
          <p className="max-w-xs text-sm text-slate-600">
            Invitations, new tasks, event changes and poll results from your spaces show up here.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((notification) => {
            const unread = !notification.readAt;
            return (
              <li
                key={notification.id}
                className={`flex items-stretch rounded-xl border bg-white ${unread ? 'border-accent' : 'border-slate-200'}`}
              >
                <button
                  type="button"
                  onClick={() => void open(notification)}
                  className="flex min-w-0 flex-1 items-start gap-3 p-3 text-left active:bg-slate-50"
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-rose-600' : 'bg-transparent'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${unread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                      {unread && <span className="sr-only">Unread: </span>}
                      {notification.title}
                    </span>
                    {notification.body && <span className="block text-sm text-slate-600">{notification.body}</span>}
                    <span className="block text-xs text-slate-500">
                      {relativeTime(Date.parse(notification.createdAt), now)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void dismiss(notification)}
                  aria-label={`Dismiss: ${notification.title}`}
                  className="flex min-w-touch items-center justify-center text-slate-400 active:bg-slate-100"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
