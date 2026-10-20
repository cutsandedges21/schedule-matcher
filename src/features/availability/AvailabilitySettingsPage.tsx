// src/features/availability/AvailabilitySettingsPage.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAsyncData } from '@/lib/useAsyncData';
import { useBusyAction } from '@/lib/useBusyAction';
import { messageOf } from '@/lib/supabaseErrors';
import { draftToInstants } from '@/domain/events';
import {
  browserTimeZone,
  formatRangeIn,
  isDateKey,
  parseTimeInput,
  todayIn,
  toTimeInput,
} from '@/domain/zonedTime';
import type { AvailabilityPreferences } from '@/domain/availability';
import BackButton from '@/components/BackButton';
import Button from '@/components/Button';
import { CheckboxField, SelectField, TextField } from '@/components/Field';
import { Badge, Card, InlineEmpty, Notice, PageHeader, Section } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import TimeZoneSelect from '@/components/TimeZoneSelect';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { addBlock, deleteBlock, getMyAvailability, savePreferences, saveTimezone } from './api';

const KIND_OPTIONS = [
  { value: 'busy', label: 'Busy — something on top of my classes' },
  { value: 'free', label: 'Free — a class is cancelled' },
];

export default function AvailabilitySettingsPage() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const toast = useToast();
  const confirm = useConfirm();
  const { busy, run } = useBusyAction();
  const data = useAsyncData(() => getMyAvailability(userId), [userId], 'Could not load your availability.');

  const [zone, setZone] = useState(browserTimeZone());
  const [prefs, setPrefs] = useState<AvailabilityPreferences | null>(null);
  const [kind, setKind] = useState<'busy' | 'free'>('busy');
  const [date, setDate] = useState(() => todayIn(browserTimeZone(), Date.now()));
  const [start, setStart] = useState(13 * 60);
  const [end, setEnd] = useState(15 * 60);
  const [label, setLabel] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);

  // Seed the form once the saved values arrive.
  useEffect(() => {
    if (!data.data) return;
    if (data.data.timezone) setZone(data.data.timezone);
    setPrefs((current) => current ?? data.data!.preferences);
  }, [data.data]);

  if (data.loading && !data.data) return <Spinner label="Loading your availability" />;

  const saved = data.data;
  const displayZone = saved?.timezone ?? browserTimeZone();

  function saveZone() {
    void run(async () => {
      try {
        await saveTimezone(userId, zone);
        await data.reload();
        toast('Time zone saved.');
      } catch (caught) {
        toast(messageOf(caught, 'Could not save your time zone.'), 'error');
      }
    });
  }

  function savePrefs() {
    if (!prefs) return;
    if (prefs.latestMinute <= prefs.earliestMinute) {
      toast('Your latest time has to be after your earliest.', 'error');
      return;
    }
    void run(async () => {
      try {
        await savePreferences(userId, prefs);
        await data.reload();
        toast('Preferences saved.');
      } catch (caught) {
        toast(messageOf(caught, 'Could not save your preferences.'), 'error');
      }
    });
  }

  function add(e: FormEvent) {
    e.preventDefault();
    setBlockError(null);
    if (!isDateKey(date)) return setBlockError('Pick a date.');
    if (start === end) return setBlockError('The end has to be after the start.');
    const { startsAt, endsAt } = draftToInstants({ date, startMinute: start, endMinute: end, timezone: displayZone });
    if (endsAt <= Date.now()) return setBlockError('That time has already passed.');

    void run(async () => {
      try {
        await addBlock(userId, { kind, label, start: startsAt, end: endsAt });
        setLabel('');
        await data.reload();
        toast(kind === 'busy' ? 'Marked as busy.' : 'Marked as free.');
      } catch (caught) {
        setBlockError(messageOf(caught, 'Could not add that.'));
      }
    });
  }

  async function remove(id: string) {
    if (!(await confirm({ title: 'Remove this change?', confirmLabel: 'Remove', destructive: true }))) return;
    void run(async () => {
      try {
        await deleteBlock(id);
        await data.reload();
      } catch (caught) {
        toast(messageOf(caught, 'Could not remove that.'), 'error');
      }
    });
  }

  return (
    <main className="flex flex-col gap-6 px-4 pb-6 pt-4">
      <div>
        <BackButton to="/schedule" />
      </div>
      <PageHeader
        title="Availability"
        subtitle="How your spaces read your schedule when they look for a time."
      />

      {data.error && <Notice tone="warning">{data.error}</Notice>}

      <Section title="Your time zone">
        <Card className="flex flex-col gap-3">
          <TimeZoneSelect
            value={zone}
            onChange={setZone}
            hint="Your weekly classes happen in this zone. Groups in other zones see them at the right local time."
          />
          {!saved?.timezone && <p className="text-xs text-amber-800">Not saved yet — spaces assume Montreal time until you save.</p>}
          <Button variant="secondary" disabled={busy || zone === saved?.timezone} onClick={saveZone}>
            Save time zone
          </Button>
        </Card>
      </Section>

      {prefs && (
        <Section title="When you like to meet">
          <Card className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <TextField
                label="Not before"
                type="time"
                value={toTimeInput(prefs.earliestMinute)}
                onChange={(e) => {
                  const minute = parseTimeInput(e.target.value);
                  if (minute !== null) setPrefs({ ...prefs, earliestMinute: minute });
                }}
              />
              <TextField
                label="Not after"
                type="time"
                value={toTimeInput(prefs.latestMinute)}
                onChange={(e) => {
                  const minute = parseTimeInput(e.target.value);
                  if (minute !== null) setPrefs({ ...prefs, latestMinute: minute === 0 ? 1440 : minute });
                }}
              />
            </div>
            <CheckboxField
              label="Keep weekends free"
              checked={prefs.avoidWeekends}
              onChange={(e) => setPrefs({ ...prefs, avoidWeekends: e.target.checked })}
            />
            <p className="text-xs text-slate-500">
              Soft limits: times outside them still show up, just lower in the list. Saving also lets spaces count you as free
              outside your busy times even if you have no classes saved.
            </p>
            {!saved?.preferencesSaved && <Badge tone="amber">Not saved yet</Badge>}
            <Button variant="secondary" disabled={busy} onClick={savePrefs}>
              Save preferences
            </Button>
          </Card>
        </Section>
      )}

      <Section title="One-off changes">
        <Card>
          <form onSubmit={add} className="flex flex-col gap-3">
            <SelectField label="This time I am" value={kind} onChange={(e) => setKind(e.target.value as 'busy' | 'free')} options={KIND_OPTIONS} />
            <div className="grid grid-cols-3 gap-2">
              <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <TextField
                label="From"
                type="time"
                value={toTimeInput(start)}
                onChange={(e) => {
                  const minute = parseTimeInput(e.target.value);
                  if (minute !== null) setStart(minute);
                }}
              />
              <TextField
                label="To"
                type="time"
                value={toTimeInput(end)}
                onChange={(e) => {
                  const minute = parseTimeInput(e.target.value);
                  if (minute !== null) setEnd(minute);
                }}
              />
            </div>
            <TextField
              label="Label (optional, only shared if you choose full details)"
              placeholder="Dentist"
              maxLength={80}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            {blockError && <Notice tone="error">{blockError}</Notice>}
            <Button type="submit" disabled={busy}>
              Add
            </Button>
          </form>
        </Card>

        <div className="mt-3">
          {(saved?.blocks.length ?? 0) === 0 ? (
            <InlineEmpty>No one-off changes coming up.</InlineEmpty>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {saved!.blocks.map((block) => (
                <li key={block.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pl-3">
                  <Badge tone={block.kind === 'busy' ? 'rose' : 'emerald'}>{block.kind === 'busy' ? 'Busy' : 'Free'}</Badge>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate">{formatRangeIn(block.start, block.end, displayZone)}</span>
                    {block.label && <span className="block truncate text-xs text-slate-500">{block.label}</span>}
                  </span>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove(block.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </main>
  );
}
