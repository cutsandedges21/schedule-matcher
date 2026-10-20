// src/features/availability/FindTimePage.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBusyAction } from '@/lib/useBusyAction';
import { messageOf } from '@/lib/supabaseErrors';
import {
  attendanceLabel,
  describeMisses,
  explainNoResult,
  findSlots,
  MAX_RANGE_DAYS,
  type MemberAvailability,
  type SlotMode,
  type SlotSearchResult,
} from '@/domain/availability';
import {
  addDays,
  daysBetween,
  formatRangeIn,
  parseTimeInput,
  timeZoneCity,
  todayIn,
  toTimeInput,
  zonedToEpoch,
} from '@/domain/zonedTime';
import Button from '@/components/Button';
import { CheckboxField, SelectField, TextField } from '@/components/Field';
import { Badge, Card, Notice, Section } from '@/components/Layout';
import SegmentedControl from '@/components/SegmentedControl';
import { useSpace } from '@/features/spaces/SpaceLayout';
import AvailabilityHeatmap from './AvailabilityHeatmap';
import { fetchSpaceAvailability } from './api';

const DURATIONS = [
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1½ hours' },
  { value: '120', label: '2 hours' },
  { value: '180', label: '3 hours' },
];

const MODES: { value: SlotMode; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'most', label: 'Most people' },
];

interface Search {
  result: SlotSearchResult;
  members: MemberAvailability[];
  duration: number;
  searchedAt: number;
}

/**
 * Plan an event: say what it is and when it could be, see when people are
 * free, then either schedule a time outright or put a few to a vote. The
 * purpose typed here travels with either choice, so nothing is typed twice.
 */
export default function FindTimePage() {
  const { space, members, me } = useSpace();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const zone = space.timezone;
  const today = todayIn(zone, Date.now());

  const [title, setTitle] = useState(params.get('title') ?? '');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(addDays(today, 6));
  const [windowStart, setWindowStart] = useState(9 * 60);
  const [windowEnd, setWindowEnd] = useState(21 * 60);
  const [duration, setDuration] = useState('60');
  const [mode, setMode] = useState<SlotMode>('everyone');
  const [weekends, setWeekends] = useState(true);
  const [included, setIncluded] = useState<Set<string>>(() => new Set(members.map((m) => m.userId)));
  const [search, setSearch] = useState<Search | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forPoll, setForPoll] = useState<Set<number>>(new Set());
  const { busy, run } = useBusyAction();

  const labelOf = (id: string) => {
    if (id === me.userId) return 'You';
    return `@${members.find((m) => m.userId === id)?.profile.username ?? 'member'}`;
  };

  function find(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const span = daysBetween(fromDate, toDate);
    if (span < 0) return setError('The end date has to be on or after the start date.');
    if (span + 1 > MAX_RANGE_DAYS) return setError(`Search at most ${MAX_RANGE_DAYS} days at a time.`);
    if (included.size === 0) return setError('Pick at least one person.');

    void run(async () => {
      try {
        const from = zonedToEpoch(fromDate, 0, zone);
        const to = zonedToEpoch(addDays(toDate, 1), 0, zone);
        const everyone = await fetchSpaceAvailability(space.id, from, to, me.userId, labelOf);
        const chosen = everyone.filter((m) => included.has(m.id));
        const now = Date.now();
        const result = findSlots(chosen, {
          timezone: zone,
          fromDate,
          toDate,
          windowStartMinute: windowStart,
          windowEndMinute: windowEnd,
          durationMinutes: Number(duration),
          stepMinutes: 30,
          mode,
          includeWeekends: weekends,
          nowMs: now,
          maxSuggestions: 8,
        });
        setSearch({ result, members: chosen, duration: Number(duration), searchedAt: now });
        setForPoll(new Set());
      } catch (caught) {
        setError(messageOf(caught, 'Could not check availability.'));
      }
    });
  }

  function schedule(start: number, end: number) {
    const query = new URLSearchParams({ start: String(start), end: String(end), title });
    navigate(`/spaces/${space.id}/events/new?${query}`);
  }

  function makePoll() {
    if (!search) return;
    const query = new URLSearchParams({
      kind: 'schedule',
      title,
      duration: String(search.duration),
      slots: [...forPoll].sort((a, b) => a - b).join(','),
    });
    navigate(`/spaces/${space.id}/polls/new?${query}`);
  }

  const result = search?.result;
  const counted = result?.countedIds.length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={find} className="flex flex-col gap-4">
        <TextField
          label="What is it for?"
          placeholder="Study session for the midterm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-2">
          <TextField label="From" type="date" value={fromDate} min={today} onChange={(e) => setFromDate(e.target.value)} />
          <TextField label="To" type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} />
          <TextField
            label="Earliest"
            type="time"
            value={toTimeInput(windowStart)}
            onChange={(e) => {
              const minute = parseTimeInput(e.target.value);
              if (minute !== null) setWindowStart(minute);
            }}
          />
          <TextField
            label="Latest end"
            type="time"
            value={toTimeInput(windowEnd)}
            onChange={(e) => {
              const minute = parseTimeInput(e.target.value);
              if (minute !== null) setWindowEnd(minute === 0 ? 1440 : minute);
            }}
          />
        </div>

        <SelectField label="How long" value={duration} onChange={(e) => setDuration(e.target.value)} options={DURATIONS} />

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Find a time for</span>
          <SegmentedControl label="Matching mode" options={MODES} value={mode} onChange={setMode} />
          <p className="text-xs text-slate-500">
            {mode === 'everyone'
              ? 'Only times when everyone picked is free. If there are none, you will see the closest options.'
              : 'The times the most people can make, with who would miss out.'}
          </p>
        </div>

        <CheckboxField label="Include weekends" checked={weekends} onChange={(e) => setWeekends(e.target.checked)} />

        <details className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <summary className="min-h-touch cursor-pointer py-2 text-sm font-medium">
            Who to include ({included.size} of {members.length})
          </summary>
          <ul>
            {members.map((member) => (
              <li key={member.userId}>
                <CheckboxField
                  label={member.userId === me.userId ? 'You' : `@${member.profile.username}`}
                  checked={included.has(member.userId)}
                  onChange={(e) =>
                    setIncluded((current) => {
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
        </details>

        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" disabled={busy}>
          {busy ? 'Checking schedules…' : 'Find times'}
        </Button>
        <p className="text-xs text-slate-500">Times are in {timeZoneCity(zone)} time. Members in other zones are matched on their own clocks.</p>
      </form>

      {result && search && (
        <>
          {result.unknownIds.length > 0 && (
            <Notice tone="warning">
              Not counted, because there is no schedule to check: {result.unknownIds.map(labelOf).join(', ')}. They might be
              busy at any of these times.
            </Notice>
          )}

          {result.reason && (
            <Notice tone={result.fellBack ? 'warning' : 'error'}>{explainNoResult(result.reason, { durationMinutes: search.duration })}</Notice>
          )}

          {result.suggestions.length > 0 && (
            <Section title={result.fellBack ? 'Closest options' : 'Suggested times'}>
              <ul className="flex flex-col gap-2">
                {result.suggestions.map((slot) => {
                  const everyone = slot.available.length === counted;
                  const misses = describeMisses(slot.preferenceMisses, labelOf);
                  return (
                    <li key={slot.start}>
                      <Card className="flex flex-col gap-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold">{formatRangeIn(slot.start, slot.end, zone)}</p>
                          <Badge tone={everyone ? 'emerald' : 'amber'}>{attendanceLabel(slot, counted)}</Badge>
                        </div>
                        {slot.unavailable.length > 0 && (
                          <p className="text-sm text-slate-700">Can&rsquo;t make it: {slot.unavailable.map(labelOf).join(', ')}</p>
                        )}
                        {misses.length > 0 && <p className="text-xs text-slate-500">{misses.join(' · ')}</p>}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" onClick={() => schedule(slot.start, slot.end)}>
                            Schedule this
                          </Button>
                          <CheckboxField
                            className="py-0"
                            label="Add to a poll"
                            checked={forPoll.has(slot.start)}
                            onChange={(e) =>
                              setForPoll((current) => {
                                const next = new Set(current);
                                if (e.target.checked) next.add(slot.start);
                                else next.delete(slot.start);
                                return next;
                              })
                            }
                          />
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
              {forPoll.size > 0 && (
                <Button className="mt-3 w-full" variant="secondary" disabled={forPoll.size < 2} onClick={makePoll}>
                  {forPoll.size < 2 ? 'Pick at least 2 times for a poll' : `Let the group vote on ${forPoll.size} times`}
                </Button>
              )}
            </Section>
          )}

          {counted > 0 && (
            <Section title="Who is free when">
              <AvailabilityHeatmap
                grid={result.grid}
                countedTotal={counted}
                labelOf={labelOf}
                timeZone={zone}
                nowMs={search.searchedAt}
              />
            </Section>
          )}
        </>
      )}
    </div>
  );
}
