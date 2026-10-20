// src/features/events/useConflicts.ts
import { useEffect, useState } from 'react';
import { memberBusy } from '@/domain/availability';
import { overlapsAny } from '@/domain/intervals';
import type { SpaceMember } from '@/domain/spaceMappers';
import { fetchSpaceAvailability } from '@/features/availability/api';

export interface ConflictReport {
  /** Members whose own data shows them busy at that time. */
  busy: string[];
  /** No schedule, or hidden: whether they are free is not known. */
  unknown: string[];
}

/**
 * Who among `memberIds` is busy between start and end, by the same engine as
 * Find a time, so the two screens can never disagree. Debounced: the event
 * form calls this on every keystroke in a time field.
 *
 * `ignoreEventId` keeps an event from conflicting with itself when it is
 * being edited or viewed. Null while loading, or if the check failed — the
 * form still works, it just has no warning to show.
 */
export function useConflicts(
  spaceId: string,
  members: readonly SpaceMember[],
  viewerId: string,
  memberIds: readonly string[],
  start: number | null,
  end: number | null,
  ignoreEventId?: string | null
): ConflictReport | null {
  const [report, setReport] = useState<ConflictReport | null>(null);
  const idsKey = [...memberIds].sort().join(',');

  useEffect(() => {
    if (start === null || end === null || end <= start || idsKey === '') {
      setReport(null);
      return;
    }
    let cancelled = false;
    const wanted = new Set(idsKey.split(','));

    const timer = setTimeout(async () => {
      try {
        const labelOf = (id: string) => `@${members.find((m) => m.userId === id)?.profile.username ?? 'member'}`;
        const everyone = await fetchSpaceAvailability(spaceId, start, end, viewerId, labelOf);
        if (cancelled) return;
        const busy: string[] = [];
        const unknown: string[] = [];
        for (const member of everyone) {
          if (!wanted.has(member.id)) continue;
          if (member.status !== 'shared') unknown.push(member.id);
          else if (overlapsAny(memberBusy(member, start, end, ignoreEventId), start, end)) busy.push(member.id);
        }
        setReport({ busy, unknown });
      } catch {
        if (!cancelled) setReport(null);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [spaceId, members, viewerId, idsKey, start, end, ignoreEventId]);

  return report;
}
