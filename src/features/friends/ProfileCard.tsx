// src/features/friends/ProfileCard.tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cosmeticById } from '@/domain/cosmetics';
import { bannerById } from '@/domain/banners';
import { effectById } from '@/domain/effects';
import CardEffect from './CardEffect';
import SchoolChip from '@/features/theme/SchoolChip';
import type { Profile } from '@/domain/types';

interface Props {
  profile: Profile;
  /** Where tapping the name goes. Omitted in the Settings preview, which is not a link. */
  nameHref?: string;
  /** Trailing control — the Compare link on the Friends list, nothing in the preview. */
  action?: ReactNode;
}

/**
 * A student's card exactly as their friends see it: their colour, their banner,
 * their effect, their school chip.
 *
 * This exists as one component so the Customization preview cannot drift from
 * the real thing on the Friends page. A second copy would look right the day it
 * was written and lie quietly from the next change onwards, which is worse than
 * having no preview — the whole promise of the preview is that it is not an
 * approximation.
 *
 * Cosmetics are applied with inline styles rather than Tailwind classes, for
 * the two reasons SchoolChip is built the same way: these are *another*
 * student's colours and the `accent` family holds the viewer's school, and
 * class names must never be built by interpolation because the JIT scanner
 * cannot see them (src/domain/color.ts).
 *
 * With all three slots null this renders exactly the card that shipped before
 * any of them existed, which is what a profile that has never opened
 * Customization still looks like.
 */
export default function ProfileCard({ profile, nameHref, action }: Props) {
  const cosmetic = cosmeticById(profile.cosmetic);
  const banner = bannerById(profile.banner);
  const effect = effectById(profile.effect);

  const names = (
    <>
      <p className={`font-semibold ${profile.shinyUsername ? 'shiny-username' : ''}`}>
        @{profile.username}
      </p>
      {profile.displayName && (
        // The muted slate is dropped on a themed card rather than kept: it
        // clears AA on white by a hair and fails it on every tint we ship.
        // The size difference carries the hierarchy instead of the colour.
        <p className={cosmetic ? 'text-sm' : 'text-sm text-slate-500'}>{profile.displayName}</p>
      )}
      <SchoolChip school={profile.school} />
    </>
  );

  // Identical classes on both branches, so the preview and the real card are
  // the same height and the same shape whether or not the name is a link.
  const nameClass = 'flex min-h-touch flex-1 flex-col justify-center gap-1';
  const nameStyle = cosmetic ? { color: cosmetic.fg } : undefined;

  return (
    <div
      // overflow-hidden is what stops an effect landing on the friend below —
      // rows sit 8px apart, and a card's decoration is deliberately clipped to
      // the card of the student who chose it.
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      style={
        cosmetic
          ? { backgroundColor: cosmetic.background, borderColor: cosmetic.border }
          : undefined
      }
    >
      <CardEffect banner={banner} effect={effect} />

      <div className="flex items-center justify-between p-3">
        {nameHref ? (
          <Link to={nameHref} className={nameClass} style={nameStyle}>
            {names}
          </Link>
        ) : (
          <div className={nameClass} style={nameStyle}>
            {names}
          </div>
        )}
        {action}
      </div>
    </div>
  );
}
