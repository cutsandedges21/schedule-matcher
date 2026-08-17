// src/features/friends/useFriends.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PROFILE_COLUMNS, rowToProfile, type ProfileRow } from '@/domain/mappers';
import type { Profile } from '@/domain/types';

export interface FriendRequest {
  id: string;
  profile: Profile;
  direction: 'incoming' | 'outgoing';
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  requester: ProfileRow;
  addressee: ProfileRow;
}

const SELECT = `
  id, requester_id, addressee_id, status,
  requester:profiles!friendships_requester_id_fkey(${PROFILE_COLUMNS}),
  addressee:profiles!friendships_addressee_id_fkey(${PROFILE_COLUMNS})
`;

export function useFriends(userId: string | undefined) {
  const [friends, setFriends] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase.from('friendships').select(SELECT);

    // A failed query is indistinguishable from "no friendships exist" unless
    // we check the error explicitly — otherwise a real outage renders a
    // serene, and false, "No friends yet".
    if (queryError) {
      setError('Could not load your friends. Check your connection and try again.');
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as FriendshipRow[];

    setFriends(
      rows
        .filter((r) => r.status === 'accepted')
        .map((r) => rowToProfile(r.requester_id === userId ? r.addressee : r.requester))
    );

    setRequests(
      rows
        .filter((r) => r.status === 'pending')
        .map((r) => ({
          id: r.id,
          profile: rowToProfile(r.requester_id === userId ? r.addressee : r.requester),
          direction: r.requester_id === userId ? ('outgoing' as const) : ('incoming' as const),
        }))
    );

    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  return { friends, requests, loading, error, reload: load };
}

/**
 * `classes` is friends-only under RLS while `profiles` is world-readable, so
 * a profile can load successfully for a total stranger while their classes
 * query silently returns []. Checking `friendships` (readable for the
 * viewer's own rows) lets callers tell "not friends" apart from "friend has
 * no schedule yet" instead of asserting the latter about someone they can't
 * actually see.
 */
export async function areFriends(viewerId: string, targetId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(requester_id.eq.${viewerId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${viewerId})`
    )
    .maybeSingle();

  if (error) throw new Error('Could not check friendship status.');
  return data !== null;
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  const { error } = await supabase.from('friendships').insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: 'pending',
  });
  if (error) {
    throw new Error(
      error.code === '23505'
        ? "You're already connected or a request is pending."
        : 'Could not send that request.'
    );
  }
}

export async function acceptFriendRequest(friendshipId: string) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', friendshipId);
  if (error) throw new Error('Could not accept that request.');
}

/** Declining and unfriending are the same operation: delete the row. */
export async function removeFriendship(friendshipId: string) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw new Error('Could not update that request.');
}

export async function searchProfiles(query: string, excludeId: string): Promise<Profile[]> {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .ilike('username', `${term}%`)
    .neq('id', excludeId)
    .limit(10);

  if (error) throw new Error('Could not search right now.');
  return ((data ?? []) as ProfileRow[]).map(rowToProfile);
}

export async function findProfileByInviteCode(code: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('invite_code', code)
    .maybeSingle();

  if (error) throw new Error('Could not check that invite link.');
  return data ? rowToProfile(data as ProfileRow) : null;
}
