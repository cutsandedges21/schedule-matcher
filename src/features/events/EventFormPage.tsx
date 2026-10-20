// src/features/events/EventFormPage.tsx
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAsyncData } from '@/lib/useAsyncData';
import { useBusyAction } from '@/lib/useBusyAction';
import { messageOf } from '@/lib/supabaseErrors';
import {
  draftToInstants,
  EVENT_DESCRIPTION_MAX,
  EVENT_LOCATION_MAX,
  EVENT_TITLE_MAX,
  validateEventDraft,
  type EventDraft,
  type EventDraftErrors,
  type SpaceEvent,
} from '@/domain/events';
import { addDays, epochToZoned, parseTimeInput, toTimeInput, todayIn, type DateKey } from '@/domain/zonedTime';
import Button from '@/components/Button';
import { CheckboxField, TextAreaField, TextField } from '@/components/Field';
import { Card, Notice, PageHeader } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import TimeZoneSelect from '@/components/TimeZoneSelect';
import { useToast } from '@/components/Toast';
import { useSpace } from '@/features/spaces/SpaceLayout';
import { createEvent, getEvent, updateEvent } from './api';
import { useConflicts } from './useConflicts';

function draftFromEvent(event: SpaceEvent): EventDraft {
  const start = epochToZoned(event.startsAt, event.timezone);
  const end = epochToZoned(event.endsAt, event.timezone);
  return {
    title: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    meetingUrl: event.meetingUrl ?? '',
    date: start.date,
    startMinute: start.minute,
    endMinute: end.minute,
    timezone: event.timezone,
    repeatWeekly: event.repeatWeeklyUntil !== null,
    repeatUntil: event.repeatWeeklyUntil ?? addDays(start.date, 28),
  };
}

/**
 * Find a time and the poll scheduler hand over `start`/`end` (epoch ms) and a
 * `title`, so a picked slot arrives already filled in — the student never
 * types the same thing twice.
 */
function draftFromParams(params: URLSearchParams, zone: string): EventDraft {
  const startParam = Number(params.get('start'));
  const endParam = Number(params.get('end'));
  const now = Date.now();
  let date: DateKey = todayIn(zone, now);
  let startMinute = Math.min(23 * 60, (Math.floor(epochToZoned(now, zone).minute / 60) + 1) * 60);
  let endMinute = Math.min(1439, startMinute + 60);

  if (startParam > 0 && endParam > startParam) {
    const start = epochToZoned(startParam, zone);
    const end = epochToZoned(endParam, zone);
    date = start.date;
    startMinute = start.minute;
    endMinute = end.minute;
  }

  return {
    title: params.get('title') ?? '',
    description: '',
    location: '',
    meetingUrl: '',
    date,
    startMinute,
    endMinute,
    timezone: zone,
    repeatWeekly: false,
    repeatUntil: addDays(date, 28),
  };
}

export default function EventFormPage() {
  const { space } = useSpace();
  const { eventId } = useParams<{ eventId: string }>();
  const [params] = useSearchParams();
  const existing = useAsyncData(() => (eventId ? getEvent(eventId) : Promise.resolve(null)), [eventId], 'Could not load this event.');

  if (eventId && existing.loading) return <Spinner inline label="Loading the event" />;
  if (eventId && !existing.data) return <Notice tone="warning">{existing.error ?? 'That event no longer exists.'}</Notice>;

  const initial = existing.data ? draftFromEvent(existing.data) : draftFromParams(params, space.timezone);
  return <EventForm key={eventId ?? 'new'} initial={initial} event={existing.data ?? null} />;
}

function EventForm({ initial, event }: { initial: EventDraft; event: SpaceEvent | null }) {
  const { space, members, me } = useSpace();
  const navigate = useNavigate();
  const toast = useToast();
  const { busy, run } = useBusyAction();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<EventDraftErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [inviteEveryone, setInviteEveryone] = useState(true);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(members.map((m) => m.userId)));

  const set = (patch: Partial<EventDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const labelOf = (id: string) => `@${members.find((m) => m.userId === id)?.profile.username ?? 'member'}`;

  const instants = useMemo(() => {
    try {
      if (draft.startMinute === draft.endMinute) return null;
      return draftToInstants(draft);
    } catch {
      return null;
    }
  }, [draft]);

  const invitedIds = event
    ? event.attendees.map((a) => a.userId)
    : inviteEveryone
      ? members.map((m) => m.userId)
      : [...chosen];
  const conflicts = useConflicts(
    space.id,
    members,
    me.userId,
    invitedIds,
    instants?.startsAt ?? null,
    instants?.endsAt ?? null,
    event?.id
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateEventDraft(draft, Date.now());
    setErrors(found);
    if (Object.keys(found).length > 0 || !instants) return;

    void run(async () => {
      setServerError(null);
      const input = {
        title: draft.title,
        startsAt: instants.startsAt,
        endsAt: instants.endsAt,
        timezone: draft.timezone,
        description: draft.description,
        location: draft.location,
        meetingUrl: draft.meetingUrl,
        repeatWeeklyUntil: draft.repeatWeekly ? draft.repeatUntil : null,
      };
      try {
        if (event) {
          await updateEvent(event.id, input);
          toast('Event updated. Attendees were told.');
          navigate(`/spaces/${space.id}/events/${event.id}`, { replace: true });
        } else {
          const id = await createEvent(space.id, input, inviteEveryone ? null : [...chosen]);
          toast('Event created. Everyone invited was notified.');
          navigate(`/spaces/${space.id}/events/${id}`, { replace: true });
        }
      } catch (caught) {
        setServerError(messageOf(caught, 'Could not save the event.'));
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <PageHeader title={event ? 'Edit event' : 'New event'} />

      <TextField
        label="What is it?"
        placeholder="Group project meeting"
        value={draft.title}
        maxLength={EVENT_TITLE_MAX}
        onChange={(e) => set({ title: e.target.value })}
        error={errors.title}
      />

      <div className="grid grid-cols-3 gap-2">
        <TextField label="Date" type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} error={errors.date} />
        <TextField
          label="Starts"
          type="time"
          value={toTimeInput(draft.startMinute)}
          onChange={(e) => {
            const minute = parseTimeInput(e.target.value);
            if (minute !== null) set({ startMinute: minute });
          }}
        />
        <TextField
          label="Ends"
          type="time"
          value={toTimeInput(draft.endMinute)}
          onChange={(e) => {
            const minute = parseTimeInput(e.target.value);
            if (minute !== null) set({ endMinute: minute });
          }}
          error={errors.endMinute}
        />
      </div>
      {draft.endMinute < draft.startMinute && (
        <p className="-mt-3 text-xs text-slate-500">Ends the next day.</p>
      )}

      <TimeZoneSelect value={draft.timezone} onChange={(zone) => set({ timezone: zone })} error={errors.timezone} />

      {conflicts && (conflicts.busy.length > 0 || conflicts.unknown.length > 0) ? (
        <Notice tone={conflicts.busy.length > 0 ? 'warning' : 'info'}>
          {conflicts.busy.length > 0 && (
            <p>
              <strong>Busy then:</strong> {conflicts.busy.map(labelOf).join(', ')}
            </p>
          )}
          {conflicts.unknown.length > 0 && (
            <p>No schedule to check: {conflicts.unknown.map(labelOf).join(', ')}</p>
          )}
        </Notice>
      ) : conflicts ? (
        <Notice tone="success">Everyone invited who shares a schedule is free then.</Notice>
      ) : null}

      <TextField
        label="Where (optional)"
        placeholder="Library, room 204"
        value={draft.location}
        maxLength={EVENT_LOCATION_MAX}
        onChange={(e) => set({ location: e.target.value })}
        error={errors.location}
      />
      <TextField
        label="Meeting link (optional)"
        type="url"
        inputMode="url"
        placeholder="https://meet.google.com/…"
        value={draft.meetingUrl}
        onChange={(e) => set({ meetingUrl: e.target.value })}
        error={errors.meetingUrl}
      />
      <TextAreaField
        label="Details (optional)"
        value={draft.description}
        maxLength={EVENT_DESCRIPTION_MAX}
        onChange={(e) => set({ description: e.target.value })}
        error={errors.description}
      />

      <Card className="flex flex-col gap-2">
        <CheckboxField
          label="Repeats every week"
          checked={draft.repeatWeekly}
          onChange={(e) => set({ repeatWeekly: e.target.checked })}
        />
        {draft.repeatWeekly && (
          <TextField
            label="Last week it happens"
            type="date"
            value={draft.repeatUntil}
            onChange={(e) => set({ repeatUntil: e.target.value })}
            error={errors.repeatUntil}
          />
        )}
      </Card>

      {!event && (
        <Card className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-700">Who is invited</p>
          <CheckboxField
            label={`Everyone in ${space.name}`}
            checked={inviteEveryone}
            onChange={(e) => setInviteEveryone(e.target.checked)}
          />
          {!inviteEveryone && (
            <ul className="flex flex-col">
              {members.map((member) => (
                <li key={member.userId}>
                  <CheckboxField
                    label={`@${member.profile.username}${member.userId === me.userId ? ' (you)' : ''}`}
                    checked={chosen.has(member.userId) || member.userId === me.userId}
                    disabled={member.userId === me.userId}
                    onChange={(e) =>
                      setChosen((current) => {
                        const next = new Set(current);
                        if (e.target.checked) next.add(member.userId);
                        else next.delete(member.userId);
                        return next;
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {serverError && <Notice tone="error">{serverError}</Notice>}

      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate(-1)} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? 'Saving…' : event ? 'Save changes' : 'Create event'}
        </Button>
      </div>
    </form>
  );
}
