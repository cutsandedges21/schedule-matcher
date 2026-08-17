// src/features/friends/FriendsPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFriends } from './useFriends';
import FriendSearch from './FriendSearch';
import PendingRequests from './PendingRequests';
import FriendCard from './FriendCard';
import { CardEffectDefs } from './CardEffect';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

/**
 * `navigator.clipboard.writeText` rejects in insecure contexts or when
 * permission is denied, and the original call had no `.catch` — a silent
 * no-op with the button never reflecting failure. Fall back to the classic
 * hidden-textarea + execCommand technique so copying still works.
 */
function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) resolve();
      else reject(new Error('Copy failed'));
    } catch (error) {
      document.body.removeChild(textarea);
      reject(error instanceof Error ? error : new Error('Copy failed'));
    }
  });
}

export default function FriendsPage() {
  const { session, profile } = useAuth();
  const { friends, requests, loading, error, reload } = useFriends(session?.user.id);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  if (loading) return <Spinner label="Loading friends" />;

  const inviteUrl = `${window.location.origin}/invite/${profile?.inviteCode}`;

  async function copyInvite() {
    setCopyFailed(false);
    try {
      await copyToClipboard(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <main className="flex flex-col gap-6 pb-6">
      {/* One <filter> node for the whole page — see CardEffect. */}
      <CardEffectDefs />

      <header className="px-4 pt-4">
        <h1 className="text-2xl font-bold">Friends</h1>
      </header>

      <section className="px-4">
        <Button variant="secondary" onClick={() => void copyInvite()} className="w-full">
          {copied ? 'Link copied' : 'Copy my invite link'}
        </Button>
        {copyFailed && (
          <p className="mt-2 text-sm text-rose-600">
            Could not copy automatically. Your link: <span className="break-all font-medium">{inviteUrl}</span>
          </p>
        )}
      </section>

      {error && <p className="px-4 text-sm text-rose-600">{error}</p>}

      <PendingRequests requests={requests} onChanged={reload} />

      <FriendSearch userId={session!.user.id} onSent={reload} />

      <section className="px-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-500">Your friends</h2>
          {friends.length > 1 && (
            <Link to="/compare" className="text-sm font-medium underline underline-offset-4">
              Compare several
            </Link>
          )}
        </div>
        {friends.length === 0 ? (
          <EmptyState title="No friends yet" body="Search for a username or share your invite link." />
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {friends.map((friend) => (
              <FriendCard key={friend.id} friend={friend} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
