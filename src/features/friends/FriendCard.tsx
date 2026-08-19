// src/features/friends/FriendCard.tsx
import { Link } from 'react-router-dom';
import ProfileCard from './ProfileCard';
import { buttonClassName } from '@/components/Button';
import type { Profile } from '@/domain/types';

/**
 * One accepted friend in the Friends list.
 *
 * The card itself is ProfileCard, shared with the preview at the top of
 * Customization so a student sees exactly what their friends do. Everything
 * specific to this list — the list item, the link to their schedule, the
 * Compare button — lives here.
 */
export default function FriendCard({ friend }: { friend: Profile }) {
  return (
    <li>
      <ProfileCard
        profile={friend}
        nameHref={`/u/${friend.username}`}
        action={
          <Link to={`/compare/${friend.username}`} className={buttonClassName('secondary')}>
            Compare
          </Link>
        }
      />
    </li>
  );
}
