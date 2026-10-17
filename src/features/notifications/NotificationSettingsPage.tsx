// src/features/notifications/NotificationSettingsPage.tsx
import { useAuth } from '@/features/auth/AuthProvider';
import { useAsyncData } from '@/lib/useAsyncData';
import { messageOf } from '@/lib/supabaseErrors';
import type { NotificationPreferences } from '@/domain/spaceMappers';
import BackButton from '@/components/BackButton';
import { CheckboxField } from '@/components/Field';
import { Card, Notice, PageHeader } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { getNotificationPreferences, saveNotificationPreferences } from './api';

const CATEGORIES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'invites', label: 'Invitations', description: 'Someone invites you to a space.' },
  { key: 'tasks', label: 'New tasks', description: 'A task is assigned to you.' },
  { key: 'deadlines', label: 'Reminders', description: 'A task is due or an event starts within 24 hours.' },
  { key: 'events', label: 'Events', description: 'You are invited to an event, or its time, place or status changes.' },
  { key: 'polls', label: 'Polls', description: 'A poll opens in your space, or one you voted in closes.' },
  { key: 'spaceUpdates', label: 'Space changes', description: 'Your role changes, or a space you are in is deleted.' },
];

export default function NotificationSettingsPage() {
  const { session } = useAuth();
  const toast = useToast();
  const prefs = useAsyncData(getNotificationPreferences, [], 'Could not load your notification settings.');

  async function toggle(key: keyof NotificationPreferences) {
    if (!session || !prefs.data) return;
    const previous = prefs.data;
    const next = { ...previous, [key]: !previous[key] };
    // Optimistic, like the school picker: the switch moves under the finger,
    // and a failed save moves it back and says so.
    prefs.setData(next);
    try {
      await saveNotificationPreferences(session.user.id, next);
    } catch (caught) {
      prefs.setData(previous);
      toast(messageOf(caught, 'Could not save that setting.'), 'error');
    }
  }

  if (prefs.loading && !prefs.data) return <Spinner label="Loading settings" />;

  return (
    <main className="flex flex-col gap-5 px-4 pb-6 pt-4">
      <div>
        <BackButton to="/notifications" />
      </div>
      <PageHeader title="Notification settings" />

      {prefs.error && <Notice tone="warning">{prefs.error}</Notice>}

      {prefs.data && (
        <Card className="divide-y divide-slate-100 py-1">
          {CATEGORIES.map((category) => (
            <CheckboxField
              key={category.key}
              label={category.label}
              description={category.description}
              checked={prefs.data![category.key]}
              onChange={() => void toggle(category.key)}
            />
          ))}
        </Card>
      )}

      <Notice tone="info">
        Notifications appear inside the app only. There are no emails or push notifications yet, so
        reminders show up the next time you open Schedule Matcher.
      </Notice>
    </main>
  );
}
