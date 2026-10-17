// src/features/spaces/SpaceLayout.tsx
import { Suspense, useCallback } from 'react';
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAsyncData } from '@/lib/useAsyncData';
import { spaceKindLabel } from '@/domain/spaces';
import type { Space, SpaceMember } from '@/domain/spaceMappers';
import BackButton from '@/components/BackButton';
import { buttonClassName } from '@/components/Button';
import Spinner from '@/components/Spinner';
import { Notice } from '@/components/Layout';
import { getSpace, listSpaceMembers } from './api';

export interface SpaceContextValue {
  space: Space;
  members: SpaceMember[];
  /** The viewer's own membership — their role decides which controls render. */
  me: SpaceMember;
  /** Refetch the space and its member list, e.g. after a role change. */
  reload: () => Promise<void>;
}

/** For pages rendered inside a space; they can rely on space and membership being loaded. */
export function useSpace(): SpaceContextValue {
  return useOutletContext<SpaceContextValue>();
}

// Find a time, Calendar, Tasks, Polls and Resources slot in here as their
// pages land (plan: docs/superpowers/plans/2026-10-17-spaces-platform.md).
const SPACE_TABS = [
  { to: '', label: 'Overview', end: true },
  { to: 'members', label: 'Members' },
  { to: 'settings', label: 'Settings' },
] as const;

interface Loaded {
  space: Space | null;
  members: SpaceMember[];
}

export default function SpaceLayout() {
  const { spaceId = '' } = useParams<{ spaceId: string }>();
  const { session } = useAuth();

  const loader = useCallback(async (): Promise<Loaded> => {
    const [space, members] = await Promise.all([getSpace(spaceId), listSpaceMembers(spaceId)]);
    return { space, members };
  }, [spaceId]);

  const { data, loading, error, reload } = useAsyncData(loader, [loader], 'Could not load this space.');

  if (loading && !data) return <Spinner label="Opening the space" />;

  if (error && !data) {
    return (
      <main className="flex flex-col gap-4 px-4 pt-4">
        <BackButton to="/spaces" />
        <Notice tone="error">{error}</Notice>
        <button type="button" className={buttonClassName('secondary')} onClick={() => void reload()}>
          Try again
        </button>
      </main>
    );
  }

  const me = data?.members.find((m) => m.userId === session?.user.id);

  // RLS returns nothing both for a space that does not exist and for one the
  // viewer is not in, and the page says the same thing for both: confirming
  // that a private space exists is itself a leak.
  if (!data?.space || !me) {
    return (
      <main className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <h1 className="text-xl font-bold">Space not found</h1>
        <p className="max-w-xs text-sm text-slate-600">
          It may have been deleted, or you are not a member. If someone sent you an invite link, open
          that link instead.
        </p>
        <Link to="/spaces" className={buttonClassName('primary')}>
          Your spaces
        </Link>
      </main>
    );
  }

  const context: SpaceContextValue = { space: data.space, members: data.members, me, reload };

  return (
    <main className="flex flex-col pb-6">
      <div className="px-4 pt-2">
        <BackButton to="/spaces" label="← Spaces" />
        <h1 className="truncate text-2xl font-bold">{data.space.name}</h1>
        <p className="text-sm text-slate-500">
          {spaceKindLabel(data.space.kind)} · {data.members.length}{' '}
          {data.members.length === 1 ? 'member' : 'members'}
        </p>
      </div>

      {/* Scrolls sideways on a phone rather than wrapping: eight labels on
          two lines read as two menus. Sticky on a phone so a long task list
          keeps its section switcher; `lg:static` because DesktopNav is
          itself sticky and this would slide underneath it (the same call
          ScheduleGrid's week header makes). */}
      <nav
        aria-label="Space sections"
        className="sticky top-0 z-10 mt-3 border-b border-slate-200 bg-slate-50/95 backdrop-blur lg:static"
      >
        <ul className="flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SPACE_TABS.map((tab) => (
            <li key={tab.label} className="shrink-0">
              <NavLink
                to={tab.to}
                end={'end' in tab ? tab.end : false}
                className={({ isActive }) =>
                  `flex min-h-touch items-center border-b-2 px-3 text-sm font-semibold whitespace-nowrap ${
                    isActive ? 'border-accent text-slate-900' : 'border-transparent text-slate-500'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-4 pt-4">
        <Suspense fallback={<Spinner inline label="Loading" />}>
          <Outlet context={context} />
        </Suspense>
      </div>
    </main>
  );
}
