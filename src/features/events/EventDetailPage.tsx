// src/features/events/EventDetailPage.tsx
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAsyncData } from '@/lib/useAsyncData';
import { useBusyAction } from '@/lib/useBusyAction';
import { messageOf } from '@/lib/supabaseErrors';
import {
  attendanceSummary,
  canManageEvent,
  expandOccurrences,
  RESPONSE_LABELS,
  responseOf,
  type AttendeeResponse,
  type SpaceEvent,
} from '@/domain/events';
import { epochToZoned, formatDateKey, formatRangeIn, timeZoneCity } from '@/domain/zonedTime';
import Avatar from '@/components/Avatar';
import Button, { buttonClassName } from '@/components/Button';
import { Badge, Card, Notice, Section } from '@/components/Layout';
import SegmentedControl from '@/components/SegmentedControl';
import Spinner from '@/components/Spinner';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { useSpace } from '@/features/spaces/SpaceLayout';
import { listSpaceTasks } from '@/features/tasks/api';
import { deleteEvent, getEvent, respondToEvent, updateEvent } from './api';
import { useConflicts } from './useConflicts';

const ANSWERS: { value: Exclude<AttendeeResponse, 'pending'>; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'declined', label: "Can't go" },
];

/** The occurrence a student cares about: the next one, or the last one once the series is over. */
function focusOccurrence(event: SpaceEvent, nowMs: number): { start: number; end: number } {
  if (!event.repeatWeeklyUntil) return { start: event.startsAt, end: event.endsAt };
  const upcoming = expandOccurrences(event, nowMs, nowMs + 400 * 86_400_000);
  return upcoming[0] ?? { start: event.startsAt, end: event.endsAt };
}

export default function EventDetailPage() {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const { space, members, me } = useSpace();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { busy, run } = useBusyAction();
  const event = useAsyncData(() => getEvent(eventId), [eventId], 'Could not load this event.');
  const tasks = useAsyncData(() => listSpaceTasks(space.id), [space.id], 'Could not load related tasks.');

  const data = event.data;
  const now = Date.now();
  const occurrence = data ? focusOccurrence(data, now) : null;
  const attendeeIds = data ? data.attendees.map((a) => a.userId) : [];
  const conflicts = useConflicts(
    space.id,
    members,
    me.userId,
    attendeeIds,
    occurrence && data?.status === 'confirmed' && occurrence.end > now ? occurrence.start : null,
    occurrence?.end ?? null,
    data?.id
  );

  if (event.loading && !data) return <Spinner inline label="Loading the event" />;
  if (!data) {
    return (
      <Notice tone="warning">
        {event.error ?? 'This event was deleted.'}{' '}
        <Link to={`/spaces/${space.id}/calendar`} className="font-semibold underline">
          Back to the calendar
        </Link>
      </Notice>
    );
  }

  const labelOf = (id: string) => `@${members.find((m) => m.userId === id)?.profile.username ?? 'former member'}`;
  const myResponse = responseOf(data, me.userId);
  const summary = attendanceSummary(data.attendees);
  const canManage = canManageEvent(data, me.userId, me.role);
  const cancelled = data.status === 'cancelled';
  const related = (tasks.data ?? []).filter((t) => t.eventId === data.id);
  const firstDay = epochToZoned(data.startsAt, data.timezone);

  function answer(response: Exclude<AttendeeResponse, 'pending'>) {
    if (!data || response === myResponse) return;
    const previous = data.attendees;
    // Optimistic: the answer shows at once and is put back if the save fails.
    event.setData({
      ...data,
      attendees: data.attendees.some((a) => a.userId === me.userId)
        ? data.attendees.map((a) => (a.userId === me.userId ? { ...a, response } : a))
        : [...data.attendees, { userId: me.userId, response, respondedAt: new Date().toISOString() }],
    });
    void respondToEvent(data.id, me.userId, response).then(
      () => toast(`Answer saved: ${RESPONSE_LABELS[response]}.`),
      (caught) => {
        event.setData({ ...data, attendees: previous });
        toast(messageOf(caught, 'Could not save your answer.'), 'error');
      }
    );
  }

  async function setCancelled(next: boolean) {
    if (!data) return;
    const ok = await confirm(
      next
        ? { title: 'Cancel this event?', body: 'Everyone invited is told. You can restore it later.', confirmLabel: 'Cancel event', destructive: true }
        : { title: 'Restore this event?', body: 'Everyone invited is told it is back on.', confirmLabel: 'Restore' }
    );
    if (!ok) return;
    void run(async () => {
      try {
        await updateEvent(data.id, { status: next ? 'cancelled' : 'confirmed' });
        await event.reload();
        toast(next ? 'Event cancelled.' : 'Event restored.');
      } catch (caught) {
        toast(messageOf(caught, 'That did not go through.'), 'error');
      }
    });
  }

  async function remove() {
    if (!data) return;
    const ok = await confirm({
      title: 'Delete this event?',
      body: 'It disappears from the calendar for everyone. Cancelling keeps a record instead.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    void run(async () => {
      try {
        await deleteEvent(data.id);
        toast('Event deleted.', 'info');
        navigate(`/spaces/${space.id}/calendar`, { replace: true });
      } catch (caught) {
        toast(messageOf(caught, 'Could not delete the event.'), 'error');
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={`text-xl font-bold ${cancelled ? 'line-through' : ''}`}>{data.title}</h2>
          {cancelled && <Badge tone="rose">Cancelled</Badge>}
        </div>
        {occurrence && <p className="mt-1 text-sm text-slate-700">{formatRangeIn(occurrence.start, occurrence.end, data.timezone)}</p>}
        {data.repeatWeeklyUntil && (
          <p className="text-sm text-slate-600">
            Every {formatDateKey(firstDay.date, 'weekday')} until {formatDateKey(data.repeatWeeklyUntil)}
          </p>
        )}
        <p className="text-xs text-slate-500">{timeZoneCity(data.timezone)} time</p>
        {data.location && <p className="mt-2 text-sm">Where: {data.location}</p>}
        {data.meetingUrl && (
          <a href={data.meetingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold underline">
            Open meeting link ↗
          </a>
        )}
        {data.description && <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{data.description}</p>}
        {data.organizerId && <p className="mt-2 text-xs text-slate-500">Organized by {labelOf(data.organizerId)}</p>}
        {data.pollId && (
          <Link to={`/spaces/${space.id}/polls/${data.pollId}`} className="mt-1 inline-block text-xs font-medium underline">
            Picked in a poll
          </Link>
        )}
      </div>

      {!cancelled && (
        <Section title={myResponse ? 'Your answer' : 'Are you coming?'}>
          <SegmentedControl
            label="Your answer"
            options={ANSWERS}
            value={(myResponse === 'pending' || myResponse === null ? '' : myResponse) as Exclude<AttendeeResponse, 'pending'>}
            onChange={answer}
          />
          {myResponse === null && (
            <p className="mt-1 text-xs text-slate-500">You were not on the invite list; answering adds you.</p>
          )}
        </Section>
      )}

      {!cancelled && conflicts && conflicts.busy.length > 0 && (
        <Notice tone="warning">
          {conflicts.busy.includes(me.userId) ? 'This overlaps something on your schedule. ' : ''}
          Busy then: {conflicts.busy.map(labelOf).join(', ')}
        </Notice>
      )}

      <Section title={`Who's coming · ${summary.going} going, ${summary.maybe} maybe, ${summary.declined} can't`}>
        <ul className="flex flex-col gap-1.5">
          {data.attendees.map((attendee) => (
            <li key={attendee.userId} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pl-3">
              <Avatar username={labelOf(attendee.userId).slice(1)} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm">{labelOf(attendee.userId)}</span>
              <Badge
                tone={
                  attendee.response === 'going'
                    ? 'emerald'
                    : attendee.response === 'maybe'
                      ? 'amber'
                      : attendee.response === 'declined'
                        ? 'slate'
                        : 'sky'
                }
              >
                {RESPONSE_LABELS[attendee.response]}
              </Badge>
            </li>
          ))}
        </ul>
      </Section>

      {related.length > 0 && (
        <Section title="Tasks for this event">
          <ul className="flex flex-col gap-1.5">
            {related.map((task) => (
              <li key={task.id}>
                <Link
                  to={`/spaces/${space.id}/tasks?task=${task.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm"
                >
                  <span className={task.status === 'done' ? 'text-slate-500 line-through' : 'font-medium'}>{task.title}</span>
                  <span aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Card className="flex flex-wrap gap-2">
        <Link to={`/spaces/${space.id}/tasks?new=1&event=${data.id}`} className={buttonClassName('secondary', undefined, 'sm')}>
          Add a task for this
        </Link>
        {canManage && (
          <>
            <Link to={`/spaces/${space.id}/events/${data.id}/edit`} className={buttonClassName('secondary', undefined, 'sm')}>
              Edit
            </Link>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void setCancelled(!cancelled)}>
              {cancelled ? 'Restore' : 'Cancel event'}
            </Button>
            <Button size="sm" variant="ghost" className="text-rose-700" disabled={busy} onClick={() => void remove()}>
              Delete
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
