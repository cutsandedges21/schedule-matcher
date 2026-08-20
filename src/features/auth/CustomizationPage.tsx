// src/features/auth/CustomizationPage.tsx
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cosmeticForHue } from '@/domain/cosmetics';
import { bannerForHue, bannerGradient } from '@/domain/banners';
import {
  EFFECT_BAND_PX,
  EFFECT_SHAPES,
  effectForHue,
  effectHueOf,
  effectShapeOf,
} from '@/domain/effects';
import { HUE_STEPS } from '@/domain/hue';
import { canPickCosmetics } from '@/domain/beta';
import CardEffect from '@/features/friends/CardEffect';
import ProfileCard from '@/features/friends/ProfileCard';
import BackButton from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import SwatchPicker, { type SwatchOption } from './SwatchPicker';
import { useAuth } from './AuthProvider';
import type { Profile } from '@/domain/types';

/** Where the effect colour wheel starts before a student has moved it. */
const DEFAULT_EFFECT_HUE = 210;

/**
 * Fed to ProfileCard so a student who can't pick cosmetics yet still sees
 * what one looks like, next to their own plain card — a teaser, not a
 * real account. lavender/nebula/stardust are hand-picked presets
 * (cosmetics.ts, banners.ts, effects.ts) chosen only to read as obviously
 * nicer than blank, not as a recommendation of that particular combination.
 */
const TEASER_PROFILE: Profile = {
  id: 'teaser',
  username: 'you',
  displayName: null,
  avatarUrl: null,
  inviteCode: '',
  school: null,
  cosmetic: 'lavender',
  banner: 'nebula',
  effect: 'stardust',
  shinyUsername: true,
};

export default function CustomizationPage() {
  const { session, profile, patchProfile } = useAuth();
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Private beta. The nav row on Settings is visible to everyone now, so
  // anyone can land here — testers get the real picker below, everyone else
  // gets a "coming soon" placeholder instead of a silent bounce back to
  // Settings. This is still only a UI gate, not enforcement — profiles_update
  // still permits the write. See domain/beta.ts.
  if (!canPickCosmetics(session?.user.email)) {
    return (
      <main className="flex flex-col gap-6 p-4 pb-6">
        <BackButton to="/settings" />
        <EmptyState
          title="Coming soon"
          body="Card colours, banners and effects for your friend card aren't open to everyone yet — here's a taste of what's coming."
        />

        {/*
          The same ProfileCard everywhere else, fed a real profile and a
          made-up one, so "blank" and "customized" sit side by side instead of
          asking a student to imagine the difference. TEASER_PROFILE is not an
          account — it never round-trips through Supabase.
        */}
        <div className="flex flex-col gap-4">
          <section>
            <h2 className="text-sm font-semibold text-slate-500">You, right now</h2>
            {profile && (
              <div className="mt-2">
                <ProfileCard profile={profile} />
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-500">What&rsquo;s coming</h2>
            <div className="mt-2">
              <ProfileCard profile={TEASER_PROFILE} />
            </div>
          </section>
        </div>
      </main>
    );
  }

  /**
   * Optimistic: patch the cached profile first so the swatch rings under the
   * finger, then write. On failure put the old value back and say so — the
   * alternative is a tap that appears to work and silently isn't there after a
   * reload. Shared by all three slots, which differ only in which column they
   * write.
   *
   * Cosmetics are free today and this writes straight from the client through
   * `profiles_update`, which lets a student set any column on their own row.
   * When they move behind the paid Pass, `cosmetic`, `banner` and `effect` all
   * have to stop being client writable: revoke column-level update from
   * `authenticated` and go through a trigger or a security-definer setter that
   * checks the Pass. See the headers of migrations 0007 and 0008. Nothing here
   * is an entitlement check.
   */
  async function choose(column: 'cosmetic' | 'banner' | 'effect', id: string | null) {
    if (!profile) return;

    const previous = profile[column];
    if (id === previous) return;

    setErrors((current) => ({ ...current, [column]: null }));
    patchProfile({ [column]: id });

    const { error } = await supabase
      .from('profiles')
      .update({ [column]: id })
      .eq('id', profile.id);

    if (error) {
      patchProfile({ [column]: previous });
      setErrors((current) => ({
        ...current,
        [column]: 'Could not save that. Check your connection and try again.',
      }));
    }
  }

  /**
   * Hue wheels rather than a fixed palette. §5.1 of the monetization design
   * rules out a free hex input because "somebody will pick white-on-white" —
   * correct about hex, wrong about colour choice generally. The part students
   * want to control is the hue, and hue has no bearing on contrast, so they
   * pick the hue and domain/hue.ts picks the lightness from a luminance target.
   * An illegible card is unreachable rather than merely discouraged.
   */
  const colourOptions: SwatchOption[] = [
    {
      id: null,
      name: 'None',
      preview: (
        <span className="flex h-full w-full items-center justify-center rounded-[inherit] border border-slate-200 bg-white text-xs font-semibold text-slate-400">
          Aa
        </span>
      ),
    },
    ...HUE_STEPS.map((hue) => {
      const cosmetic = cosmeticForHue(hue);
      return {
        id: cosmetic.id,
        name: cosmetic.name,
        preview: (
          <span
            className="flex h-full w-full items-center justify-center rounded-[inherit] border text-[11px] font-bold"
            style={{
              backgroundColor: cosmetic.background,
              borderColor: cosmetic.border,
              color: cosmetic.fg,
            }}
          >
            Aa
          </span>
        ),
      };
    }),
  ];

  const bannerOptions: SwatchOption[] = [
    {
      id: null,
      name: 'None',
      preview: <span className="block h-full w-full rounded-[inherit] border border-slate-200 bg-white" />,
    },
    // The swatch animates exactly as the real strip does, so the picker shows
    // the moving thing rather than a still of it.
    ...HUE_STEPS.map((hue) => {
      const banner = bannerForHue(hue);
      return {
        id: banner.id,
        name: banner.name,
        preview: (
          <span
            className="card-strip block h-full w-full rounded-[inherit]"
            style={{
              backgroundImage: bannerGradient(banner),
              backgroundSize: '200% 100%',
              animation: 'card-strip-drift 6s linear infinite',
            }}
          />
        ),
      };
    }),
  ];

  /**
   * An effect is two choices — a shape and a hue — stored in one column as
   * `rain-210`. Changing one keeps the other, so picking a colour does not
   * silently reset the shape a student just chose.
   */
  const effectShape = effectShapeOf(profile?.effect);
  const effectHue = effectHueOf(profile?.effect) ?? DEFAULT_EFFECT_HUE;

  const effectShapeOptions: SwatchOption[] = [
    {
      id: null,
      name: 'None',
      preview: <span className="block h-full w-full rounded-[inherit] border border-slate-200 bg-white" />,
    },
    ...EFFECT_SHAPES.map((shape) => {
      const effect = effectForHue(shape, effectHue);
      return {
        id: effect.id,
        name: `${shape[0].toUpperCase()}${shape.slice(1)}`,
        preview: (
          <span className="flex h-full w-full items-start overflow-hidden rounded-[inherit] border border-slate-200 bg-white">
            <span className="relative block w-full" style={{ height: EFFECT_BAND_PX }}>
              <CardEffect banner={null} effect={effect} />
            </span>
          </span>
        ),
      };
    }),
  ];

  const effectColourOptions: SwatchOption[] = HUE_STEPS.map((hue) => {
    const effect = effectForHue(effectShape ?? 'rain', hue);
    return {
      id: effect.id,
      name: effect.name,
      preview: (
        <span className="flex h-full w-full items-center justify-center rounded-[inherit] border border-slate-200 bg-white">
          <span className="block h-5 w-5 rounded-full" style={{ backgroundColor: effect.colour }} />
        </span>
      ),
    };
  });

  return (
    <main className="flex flex-col gap-6 p-4 pb-6">
      <div>
        <BackButton to="/settings" />
        <h1 className="mt-1 text-2xl font-bold">Customization</h1>
      </div>

      {/*
        The real thing, not a mock-up: the same ProfileCard the Friends page
        renders, fed the student's own profile. It updates as each swatch is
        tapped because `patchProfile` writes to the cached profile first, so
        the preview moves under the finger rather than after the round trip.

        No Compare button and no link — comparing your schedule with your own
        is not a thing, and a link out of the page you are editing is a trap.
      */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500">What your friends see</h2>
        {profile && (
          <div className="mt-2">
            <ProfileCard profile={profile} />
          </div>
        )}
      </section>

      <SwatchPicker
        title="Card colour"
        description="How your name looks on your friends' Friends page. Only they see it."
        options={colourOptions}
        selectedId={profile?.cosmetic ?? null}
        onChoose={(id) => void choose('cosmetic', id)}
        error={errors.cosmetic ?? null}
        columns={8}
      />

      <SwatchPicker
        title="Banner"
        description="An animated strip across the top of your card."
        options={bannerOptions}
        selectedId={profile?.banner ?? null}
        onChoose={(id) => void choose('banner', id)}
        error={errors.banner ?? null}
        columns={8}
      />

      <SwatchPicker
        title="Effect"
        description="Animates under your banner — or on its own, if you skip one."
        options={effectShapeOptions}
        selectedId={profile?.effect ?? null}
        onChoose={(id) => void choose('effect', id)}
        error={errors.effect ?? null}
      />

      {/* Only once a shape is chosen — a colour with no shape is not an effect,
          and offering the wheel first invites a tap that does nothing visible. */}
      {effectShape && (
        <SwatchPicker
          title="Effect colour"
          description="Any hue you like. The app picks the shade so it stays visible."
          options={effectColourOptions}
          selectedId={profile?.effect ?? null}
          onChoose={(id) => void choose('effect', id)}
          error={null}
          columns={8}
        />
      )}
    </main>
  );
}
