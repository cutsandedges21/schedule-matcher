// src/features/friends/useFriends.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { rowToProfile, type ProfileRow } from '@/domain/mappers';
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
  requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url, invite_code),
  addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url, invite_code)
`;

export function useFriends(userId: string | undefined) {
  const [friends, setFriends] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data } = await supabase.from('friendships').select(SELECT);
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

  return { friends, requests, loading, reload: load };
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

  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, invite_code')
    .ilike('username', `${term}%`)
    .neq('id', excludeId)
    .limit(10);

  return ((data ?? []) as ProfileRow[]).map(rowToProfile);
}

export async function findProfileByInviteCode(code: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, invite_code')
    .eq('invite_code', code)
    .maybeSingle();

  return data ? rowToProfile(data as ProfileRow) : null;
}
