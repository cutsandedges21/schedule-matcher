// src/features/friends/FriendCard.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import ProfileCard from './ProfileCard';
import { removeFriend } from './useFriends';
import Button, { buttonClassName } from '@/components/Button';
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
        // px-2.5/text-xs shrink the footprint below the shared `sm` size
        // (px-3/text-sm) — just for this pair, not the Button component's
        // size scale used everywhere else. min-h-touch stays untouched:
        // Button.tsx is deliberate about never shrinking the 44px tap
        // target itself, only the padding/type around it.
        action={
          <div className="flex shrink-0 gap-1.5">
            <Link
              to={`/compare/${friend.username}`}
              className={buttonClassName('secondary', 'px-2.5 text-xs', 'sm')}
            >
              Compare
            </Link>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void handleRemove()}
              className="px-2.5 text-xs"
            >
              {busy ? '…' : 'Remove'}
            </Button>
          </div>
        }
      />
      {error && <p className="mt-1 px-3 text-xs text-rose-600">{error}</p>}
    </li>
  );
}
