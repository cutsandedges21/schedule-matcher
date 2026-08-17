// src/features/friends/FriendCard.tsx
import { Link } from 'react-router-dom';
import { cosmeticById } from '@/domain/cosmetics';
import { bannerById } from '@/domain/banners';
import { effectById } from '@/domain/effects';
import CardEffect from './CardEffect';
import { buttonClassName } from '@/components/Button';
import SchoolChip from '@/features/theme/SchoolChip';
import type { Profile } from '@/domain/types';

/**
 * One accepted friend, painted in *their* cosmetics — hence inline styles
 * rather than Tailwind classes, for the two reasons SchoolChip is built the
 * same way:
 *
 * 1. These are another student's colours. The `accent` family holds the
 *    *viewer's* school, so repainting the viewer's chrome in a friend's
 *    colours would make "whose screen am I on" genuinely ambiguous.
 * 2. Class names may never be built by interpolation — the JIT scanner cannot
 *    see them and silently drops the styles (see src/domain/color.ts).
 *
 * Three independent slots, any combination of which may be null: a colour
 * (`cosmetic`), a strip (`banner`) and slime (`effect`). With all three null
 * this renders exactly the card that shipped before any of them existed, which
 * is what every profile that has never opened Settings still looks like.
 */
export default function FriendCard({ friend }: { friend: Profile }) {
  const cosmetic = cosmeticById(friend.cosmetic);
  const banner = bannerById(friend.banner);
  const effect = effectById(friend.effect);

  return (
    <li
      // overflow-hidden is what stops a drip landing on the friend below —
      // rows sit 8px apart, and the slime is deliberately clipped to the card
      // of the student who chose it.
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      style={
        cosmetic
          ? { backgroundColor: cosmetic.background, borderColor: cosmetic.border }
          : undefined
      }
    >
      <CardEffect banner={banner} effect={effect} />

      <div className="flex items-center justify-between p-3">
        <Link
          to={`/u/${friend.username}`}
          className="flex min-h-touch flex-1 flex-col justify-center gap-1"
          style={cosmetic ? { color: cosmetic.fg } : undefined}
        >
          <p className="font-semibold">@{friend.username}</p>
          {friend.displayName && (
            // The muted slate is dropped on a themed card rather than kept: it
            // clears AA on white by a hair and fails it on every tint we ship.
            // The size difference carries the hierarchy instead of the colour.
            <p className={cosmetic ? 'text-sm' : 'text-sm text-slate-500'}>{friend.displayName}</p>
          )}
          <SchoolChip school={friend.school} />
        </Link>
        <Link to={`/compare/${friend.username}`} className={buttonClassName('secondary')}>
          Compare
        </Link>
      </div>
    </li>
  );
}
