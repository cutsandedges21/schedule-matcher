// src/features/notifications/api.ts
import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/lib/supabaseErrors';
import {
  NOTIFICATION_COLUMNS,
  notificationPreferencesToRow,
  rowToNotification,
  rowToNotificationPreferences,
  type AppNotification,
  type NotificationPreferences,
  type NotificationPreferencesRow,
  type NotificationRow,
} from '@/domain/spaceMappers';

const PAGE_SIZE = 50;

export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  throwIfError(error, 'Could not load your notifications.');
  return ((data ?? []) as NotificationRow[]).map(rowToNotification);
}

/** A HEAD request: the count travels in a header and no rows come back. */
export async function countUnread(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .is('dismissed_at', null);
  throwIfError(error, 'Could not check for notifications.');
  return count ?? 0;
}

export async function markRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null);
  throwIfError(error, 'Could not mark that as read.');
}

/** RLS limits this to the caller's own rows; there is no user id to pass. */
export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  throwIfError(error, 'Could not mark everything as read.');
}

export async function dismissNotification(id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ dismissed_at: now, read_at: now })
    .eq('id', id);
  throwIfError(error, 'Could not dismiss that notification.');
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('invites, space_updates, tasks, deadlines, events, polls')
    .maybeSingle();
  throwIfError(error, 'Could not load your notification settings.');
  return rowToNotificationPreferences(data as NotificationPreferencesRow | null);
}

export async function saveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences
): Promise<void> {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: userId, ...notificationPreferencesToRow(prefs) }, { onConflict: 'user_id' });
  throwIfError(error, 'Could not save your notification settings.');
}

/**
 * Materialises due reminders (task due within 24 h, event starting within
 * 24 h) for the caller — migration 0021. There is no background job: this runs
 * when the app is open, so a reminder appears the next time the student looks.
 * Fails quietly before that migration exists; nothing here is load-bearing.
 */
export async function syncReminders(): Promise<void> {
  const { error } = await supabase.rpc('sync_my_reminders');
  if (error && import.meta.env.DEV) {
    console.warn('[notifications] reminders not synced:', error.message);
  }
}
