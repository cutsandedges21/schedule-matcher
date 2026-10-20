// src/features/availability/api.ts
import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/lib/supabaseErrors';
import { DEFAULT_PREFERENCES, type AvailabilityPreferences, type MemberAvailability } from '@/domain/availability';
import { availabilityToMembers, type AvailabilityMemberJson } from '@/domain/planMappers';

export interface AvailabilityBlock {
  id: string;
  kind: 'busy' | 'free';
  label: string | null;
  start: number;
  end: number;
}

export interface MyAvailability {
  /** Null when never set; the app then uses the device zone for display and the server Montreal. */
  timezone: string | null;
  preferences: AvailabilityPreferences;
  /** False until saved once — the signal that counts a student with no classes. */
  preferencesSaved: boolean;
  blocks: AvailabilityBlock[];
}

export async function getMyAvailability(userId: string): Promise<MyAvailability> {
  const [profile, prefs, blocks] = await Promise.all([
    supabase.from('profiles').select('timezone').eq('id', userId).maybeSingle(),
    supabase
      .from('availability_preferences')
      .select('earliest_minute, latest_minute, avoid_weekends')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('availability_blocks')
      .select('id, kind, label, starts_at, ends_at')
      .eq('user_id', userId)
      .gt('ends_at', new Date(Date.now() - 86_400_000).toISOString())
      .order('starts_at'),
  ]);
  throwIfError(profile.error, 'Could not load your time zone.');
  throwIfError(prefs.error, 'Could not load your preferences.');
  throwIfError(blocks.error, 'Could not load your one-off changes.');

  const p = prefs.data as { earliest_minute: number; latest_minute: number; avoid_weekends: boolean } | null;
  return {
    timezone: (profile.data as { timezone: string | null } | null)?.timezone ?? null,
    preferences: p
      ? { earliestMinute: p.earliest_minute, latestMinute: p.latest_minute, avoidWeekends: p.avoid_weekends }
      : { ...DEFAULT_PREFERENCES },
    preferencesSaved: p !== null,
    blocks: ((blocks.data ?? []) as { id: string; kind: string; label: string | null; starts_at: string; ends_at: string }[]).map(
      (b) => ({
        id: b.id,
        kind: b.kind === 'free' ? 'free' : 'busy',
        label: b.label,
        start: Date.parse(b.starts_at),
        end: Date.parse(b.ends_at),
      })
    ),
  };
}

export async function saveTimezone(userId: string, timezone: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ timezone }).eq('id', userId);
  throwIfError(error, 'Could not save your time zone.');
}

export async function savePreferences(userId: string, prefs: AvailabilityPreferences): Promise<void> {
  const { error } = await supabase.from('availability_preferences').upsert(
    {
      user_id: userId,
      earliest_minute: prefs.earliestMinute,
      latest_minute: prefs.latestMinute,
      avoid_weekends: prefs.avoidWeekends,
    },
    { onConflict: 'user_id' }
  );
  throwIfError(error, 'Could not save your preferences.');
}

export async function addBlock(
  userId: string,
  block: { kind: 'busy' | 'free'; label: string; start: number; end: number }
): Promise<void> {
  const { error } = await supabase.from('availability_blocks').insert({
    user_id: userId,
    kind: block.kind,
    label: block.label.trim() || null,
    starts_at: new Date(block.start).toISOString(),
    ends_at: new Date(block.end).toISOString(),
  });
  throwIfError(error, 'Could not add that change.');
}

export async function deleteBlock(blockId: string): Promise<void> {
  const { error } = await supabase.from('availability_blocks').delete().eq('id', blockId);
  throwIfError(error, 'Could not remove that change.');
}

/** Every member's availability in one space, already shaped for the engine. */
export async function fetchSpaceAvailability(
  spaceId: string,
  from: number,
  to: number,
  viewerId: string,
  labelOf: (userId: string) => string
): Promise<MemberAvailability[]> {
  const { data, error } = await supabase.rpc('space_availability', {
    p_space_id: spaceId,
    p_from: new Date(from).toISOString(),
    p_to: new Date(to).toISOString(),
  });
  throwIfError(error, 'Could not load everyone’s availability.');
  const rows = ((data as { members?: AvailabilityMemberJson[] } | null)?.members ?? []) as AvailabilityMemberJson[];
  return availabilityToMembers(rows, viewerId, labelOf);
}
