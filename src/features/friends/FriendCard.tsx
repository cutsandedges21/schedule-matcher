// src/features/friends/FriendCard.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import ProfileCard from './ProfileCard';
import { removeFriend } from './useFriends';
import { buttonClassName } from '@/components/Button';
import type { Profile } from '@/domain/types';

interface Props {
  friend: Profile;
  myUserId: string;
  /** Refetches the friends list — same contract as PendingRequests' onChanged. */
  onRemoved: () => void;
}

/**
 * One accepted friend in the Friends list.
 *
 * The card itself is ProfileCard, shared with the preview at the top of
 * Customization so a student sees exactly what their friends do. Everything
 * specific to this list — the list item, the link to their schedule, the
 * Compare button, removing the friend — lives here.
 */
export default function FriendCard({ friend, myUserId, onRemoved }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      await removeFriend(myUserId, friend.id);
      onRemoved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove that friend.');
      setBusy(false);
    }
  }

  return (
    <li>
      <ProfileCard
        profile={friend}
        nameHref={`/u/${friend.username}`}
        // Compare stays a real button (px-2.5/text-xs shrinks it below the
        // shared `sm` size, just for this one, not the Button component's
        // scale used everywhere else — min-h-touch's 44px floor is untouched).
        // Remove is a plain underlined text link below it, the same
        // de-emphasized-secondary-action style "Compare several" already uses
        // on this page — deliberately smaller than Compare rather than
        // fighting Button.tsx's touch-target floor with overrides.
        action={
          <div className="flex flex-col items-center gap-1">
            <Link
              to={`/compare/${friend.username}`}
              className={buttonClassName('secondary', 'px-2 text-[11px]', 'sm')}
            >
              Compare
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRemove()}
              className="px-1 text-xs font-medium text-slate-400 underline underline-offset-2 disabled:opacity-50"
            >
              {busy ? '…' : 'Remove'}
            </button>
          </div>
        }
      />
      {error && <p className="mt-1 px-3 text-xs text-rose-600">{error}</p>}
    </li>
  );
}
