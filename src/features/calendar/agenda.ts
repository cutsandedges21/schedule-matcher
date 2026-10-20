// src/features/calendar/agenda.ts
import { occurrencesInRange, responseOf, type SpaceEvent } from '@/domain/events';
import { pollIsOpen, type Poll } from '@/domain/polls';
import type { AgendaItem } from './AgendaList';

const RESPONSE_BADGES = {
  going: { text: 'Going', tone: 'emerald' },
  maybe: { text: 'Maybe', tone: 'amber' },
  declined: { text: 'Not going', tone: 'slate' },
  pending: { text: 'Reply', tone: 'sky' },
} as const;

export function eventItems(
  events: readonly SpaceEvent[],
  from: number,
  to: number,
  viewerId: string,
  options: { showSpace?: boolean } = {}
): AgendaItem[] {
  return occurrencesInRange(events, from, to).map(({ event, start, end }) => {
    const response = responseOf(event, viewerId);
    const detail = [options.showSpace ? event.spaceName : null, event.location].filter(Boolean).join(' · ');
    return {
      key: `${event.id}-${start}`,
      start,
      end,
      title: event.title,
      detail: detail || null,
      href: `/spaces/${event.spaceId}/events/${event.id}`,
      tone: event.status === 'cancelled' ? 'cancelled' : 'event',
      badge: response ? RESPONSE_BADGES[response] : undefined,
    };
  });
}

/** Open scheduling polls' times, shown as proposals — never as events. */
export function proposedItems(polls: readonly Poll[], from: number, to: number, nowMs: number): AgendaItem[] {
  return polls
    .filter((poll) => poll.kind === 'schedule' && pollIsOpen(poll, nowMs) && !poll.eventId)
    .flatMap((poll) =>
      poll.options
        .filter((o) => o.startsAt !== null && o.endsAt !== null && o.startsAt < to && o.endsAt > from)
        .map((o) => ({
          key: `${poll.id}-${o.id}`,
          start: o.startsAt as number,
          end: o.endsAt as number,
          title: poll.question,
          detail: 'Vote in the poll',
          href: `/spaces/${poll.spaceId}/polls/${poll.id}`,
          tone: 'proposed' as const,
        }))
    );
}
