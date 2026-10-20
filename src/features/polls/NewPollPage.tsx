// src/features/polls/NewPollPage.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAsyncData } from '@/lib/useAsyncData';
import { useBusyAction } from '@/lib/useBusyAction';
import { messageOf } from '@/lib/supabaseErrors';
import {
  MAX_OPTIONS,
  OPTION_MAX,
  QUESTION_MAX,
  validatePollDraft,
  VISIBILITY_LABELS,
  type Poll,
  type PollDraftErrors,
  type PollKind,
  type ResultsVisibility,
} from '@/domain/polls';
import { addDays, formatRangeIn, parseTimeInput, todayIn, toTimeInput, zonedToEpoch } from '@/domain/zonedTime';
import Button from '@/components/Button';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/Field';
import { Card, Notice, PageHeader } from '@/components/Layout';
import SegmentedControl from '@/components/SegmentedControl';
import Spinner from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { useSpace } from '@/features/spaces/SpaceLayout';
import { createPoll, getPoll } from './api';

const KINDS: { value: PollKind; label: string }[] = [
  { value: 'general', label: 'Question' },
  { value: 'schedule', label: 'Pick a time' },
];

const VISIBILITY_OPTIONS = (Object.keys(VISIBILITY_LABELS) as ResultsVisibility[]).map((value) => ({
  value,
  label: VISIBILITY_LABELS[value],
}));

const DURATIONS = ['30', '45', '60', '90', '120', '180'].map((m) => ({ value: m, label: `${m} minutes` }));

interface Seed {
  kind: PollKind;
  question: string;
  labels: string[];
  slots: number[];
  duration: number;
}

/**
 * Find a time hands over `slots` (start instants) and a `duration`; a tie
 * hands over `runoff` (the poll) and `keep` (the tied options). Either way the
 * poll arrives filled in.
 */
function seedFrom(params: URLSearchParams, runoff: Poll | null): Seed {
  if (runoff) {
    const keep = new Set((params.get('keep') ?? '').split(',').filter(Boolean));
    const options = runoff.options.filter((o) => keep.size === 0 || keep.has(o.id));
    return {
      kind: runoff.kind,
      question: runoff.question.startsWith('Runoff: ') ? runoff.question : `Runoff: ${runoff.question}`.slice(0, QUESTION_MAX),
      labels: options.map((o) => o.label),
      slots: options.flatMap((o) => (o.startsAt === null ? [] : [o.startsAt])),
      duration: runoff.durationMinutes ?? 60,
    };
  }
  const slots = (params.get('slots') ?? '').split(',').map(Number).filter((n) => n > 0);
  return {
    kind: params.get('kind') === 'schedule' || slots.length > 0 ? 'schedule' : 'general',
    question: params.get('title') ? `When should we meet for ${params.get('title')}?`.slice(0, QUESTION_MAX) : '',
    labels: ['', ''],
    slots,
    duration: Number(params.get('duration')) || 60,
  };
}

export default function NewPollPage() {
  const [params] = useSearchParams();
  const runoffId = params.get('runoff');
  const runoff = useAsyncData(() => (runoffId ? getPoll(runoffId) : Promise.resolve(null)), [runoffId], 'Could not load that poll.');
  if (runoffId && runoff.loading) return <Spinner inline label="Loading" />;
  return <PollForm seed={seedFrom(params, runoff.data ?? null)} />;
}

function PollForm({ seed }: { seed: Seed }) {
  const { space } = useSpace();
  const navigate = useNavigate();
  const toast = useToast();
  const zone = space.timezone;
  const { busy, run } = useBusyAction();

  const [kind, setKind] = useState<PollKind>(seed.kind);
  const [question, setQuestion] = useState(seed.question);
  const [description, setDescription] = useState('');
  const [labels, setLabels] = useState<string[]>(seed.labels.length >= 2 ? seed.labels : ['', '']);
  const [slots, setSlots] = useState<number[]>(seed.slots);
  const [duration, setDuration] = useState(String(seed.duration));
  const [slotDate, setSlotDate] = useState(() => todayIn(zone, Date.now()));
  const [slotMinute, setSlotMinute] = useState(18 * 60);
  const [allowMultiple, setAllowMultiple] = useState(seed.kind === 'schedule');
  const [anonymous, setAnonymous] = useState(false);
  const [visibility, setVisibility] = useState<ResultsVisibility>('always');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState(() => addDays(todayIn(zone, Date.now()), 2));
  const [deadlineMinute, setDeadlineMinute] = useState(17 * 60);
  const [errors, setErrors] = useState<PollDraftErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const minutes = Number(duration);
  const timeOptions = [...slots].sort((a, b) => a - b).map((start) => ({
    start,
    end: start + minutes * 60_000,
    label: formatRangeIn(start, start + minutes * 60_000, zone),
  }));

  function addSlot() {
    const start = zonedToEpoch(slotDate, slotMinute, zone);
    if (slots.includes(start)) return;
    setSlots([...slots, start]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const options =
      kind === 'schedule'
        ? timeOptions.map((o) => ({ label: o.label, startsAt: o.start, endsAt: o.end }))
        : labels.map((label) => ({ label }));
    const deadline = hasDeadline ? zonedToEpoch(deadlineDate, deadlineMinute, zone) : null;
    const found = validatePollDraft({ question, description, kind, options, deadline }, Date.now());
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    void run(async () => {
      setServerError(null);
      try {
        const id = await createPoll(space.id, {
          question,
          description,
          kind,
          options,
          allowMultiple,
          anonymous,
          resultsVisibility: visibility,
          deadline,
          durationMinutes: kind === 'schedule' ? minutes : null,
          timezone: kind === 'schedule' ? zone : null,
        });
        toast('Poll posted. Everyone in the space was notified.');
        navigate(`/spaces/${space.id}/polls/${id}`, { replace: true });
      } catch (caught) {
        setServerError(messageOf(caught, 'Could not create the poll.'));
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <PageHeader title="New poll" />
      <SegmentedControl label="Kind of poll" options={KINDS} value={kind} onChange={(k) => { setKind(k); setAllowMultiple(k === 'schedule'); }} />

      <TextField
        label="Question"
        placeholder={kind === 'schedule' ? 'When should we meet?' : 'Where should we eat after the exam?'}
        value={question}
        maxLength={QUESTION_MAX}
        onChange={(e) => setQuestion(e.target.value)}
        error={errors.question}
      />
      <TextAreaField label="Details (optional)" value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} error={errors.description} />

      {kind === 'general' ? (
        <Card className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-700">Options</p>
          {labels.map((label, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  label={`Option ${i + 1}`}
                  hideLabel
                  placeholder={`Option ${i + 1}`}
                  value={label}
                  maxLength={OPTION_MAX}
                  onChange={(e) => setLabels(labels.map((l, j) => (j === i ? e.target.value : l)))}
                />
              </div>
              {labels.length > 2 && (
                <Button variant="ghost" aria-label={`Remove option ${i + 1}`} onClick={() => setLabels(labels.filter((_, j) => j !== i))}>
                  ×
                </Button>
              )}
            </div>
          ))}
          {labels.length < MAX_OPTIONS && (
            <Button variant="secondary" size="sm" className="self-start" onClick={() => setLabels([...labels, ''])}>
              + Add option
            </Button>
          )}
          {errors.options && <p className="text-sm text-rose-600">{errors.options}</p>}
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <SelectField label="Meeting length" value={duration} onChange={(e) => setDuration(e.target.value)} options={DURATIONS} />
          {timeOptions.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {timeOptions.map((o) => (
                <li key={o.start} className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                  <span>{o.label}</span>
                  <Button size="sm" variant="ghost" aria-label={`Remove ${o.label}`} onClick={() => setSlots(slots.filter((s) => s !== o.start))}>
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <TextField label="Date" type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
            <TextField
              label="Start"
              type="time"
              value={toTimeInput(slotMinute)}
              onChange={(e) => {
                const minute = parseTimeInput(e.target.value);
                if (minute !== null) setSlotMinute(minute);
              }}
            />
            <Button variant="secondary" onClick={addSlot}>
              Add
            </Button>
          </div>
          {errors.options && <p className="text-sm text-rose-600">{errors.options}</p>}
        </Card>
      )}

      <Card className="flex flex-col gap-1">
        <CheckboxField label="People can pick more than one" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} />
        <CheckboxField
          label="Anonymous"
          description="Shows how many picked each option, never who."
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
        />
        <SelectField label="Results" value={visibility} onChange={(e) => setVisibility(e.target.value as ResultsVisibility)} options={VISIBILITY_OPTIONS} />
        <CheckboxField label="Close it automatically" checked={hasDeadline} onChange={(e) => setHasDeadline(e.target.checked)} />
        {hasDeadline && (
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Deadline" type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} error={errors.deadline} />
            <TextField
              label="At"
              type="time"
              value={toTimeInput(deadlineMinute)}
              onChange={(e) => {
                const minute = parseTimeInput(e.target.value);
                if (minute !== null) setDeadlineMinute(minute);
              }}
            />
          </div>
        )}
      </Card>

      {serverError && <Notice tone="error">{serverError}</Notice>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => navigate(-1)} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={busy}>
          {busy ? 'Posting…' : 'Post poll'}
        </Button>
      </div>
    </form>
  );
}
