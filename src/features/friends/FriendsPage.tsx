// src/features/friends/FriendsPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFriends } from './useFriends';
import FriendSearch from './FriendSearch';
import PendingRequests from './PendingRequests';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

export default function FriendsPage() {
  const { session, profile } = useAuth();
  const { friends, requests, loading, reload } = useFriends(session?.user.id);
  const [copied, setCopied] = useState(false);

  if (loading) return <Spinner label="Loading friends" />;

  const inviteUrl = `${window.location.origin}/invite/${profile?.inviteCode}`;

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="flex flex-col gap-6 pb-6">
      <header className="px-4 pt-4">
        <h1 className="text-2xl font-bold">Friends</h1>
      </header>

      <section className="px-4">
        <Button variant="secondary" onClick={() => void copyInvite()} className="w-full">
          {copied ? 'Link copied' : 'Copy my invite link'}
        </Button>
      </section>

      <PendingRequests requests={requests} onChanged={reload} />

      <FriendSearch userId={session!.user.id} onSent={reload} />

      <section className="px-4">
        <h2 className="text-sm font-semibold text-slate-500">Your friends</h2>
        {friends.length === 0 ? (
          <EmptyState title="No friends yet" body="Search for a username or share your invite link." />
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {friends.map((friend) => (
              <li key={friend.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                <Link to={`/u/${friend.username}`} className="flex-1">
                  <p className="font-semibold">@{friend.username}</p>
                  {friend.displayName && <p className="text-sm text-slate-500">{friend.displayName}</p>}
                </Link>
                <Link to={`/compare/${friend.username}`}>
                  <Button variant="secondary">Compare</Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
