// src/features/tasks/TaskForm.tsx
import { useState, type FormEvent } from 'react';
import { useBusyAction } from '@/lib/useBusyAction';
import { messageOf } from '@/lib/supabaseErrors';
import {
  PRIORITY_LABELS,
  TASK_DESCRIPTION_MAX,
  TASK_TITLE_MAX,
  validateTaskDraft,
  type TaskDraft,
  type TaskDraftErrors,
  type TaskPriority,
  type SpaceTask,
} from '@/domain/tasks';
import { epochToZoned, formatRangeIn, parseTimeInput, toTimeInput, zonedToEpoch } from '@/domain/zonedTime';
import type { SpaceEvent } from '@/domain/events';
import type { SpaceMember } from '@/domain/spaceMappers';
import Button from '@/components/Button';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/Field';
import { Card, Notice } from '@/components/Layout';
import { createTask, setAssignees, updateTask } from './api';

const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}));

export interface TaskFormProps {
  spaceId: string;
  timezone: string;
  members: readonly SpaceMember[];
  viewerId: string;
  events: readonly SpaceEvent[];
  /** Editing this task; creating when absent. */
  task?: SpaceTask;
  parent?: SpaceTask | null;
  presetEventId?: string | null;
  onSaved: (message: string) => void;
  onCancel: () => void;
}

function draftFrom(task: SpaceTask | undefined, timezone: string): TaskDraft {
  if (!task || task.dueAt === null) {
    return { title: task?.title ?? '', description: task?.description ?? '', priority: task?.priority ?? 'normal', dueDate: '', dueMinute: 17 * 60, linkUrl: task?.linkUrl ?? '' };
  }
  const due = epochToZoned(task.dueAt, timezone);
  return {
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    dueDate: due.date,
    dueMinute: due.minute,
    linkUrl: task.linkUrl ?? '',
  };
}

export default function TaskForm(props: TaskFormProps) {
  const { spaceId, timezone, members, viewerId, events, task, parent, presetEventId, onSaved, onCancel } = props;
  const [draft, setDraft] = useState(() => draftFrom(task, timezone));
  const [isAssignment, setIsAssignment] = useState(false);
  const [eventId, setEventId] = useState<string>(task?.eventId ?? presetEventId ?? '');
  const [assignees, setAssigneesState] = useState<Set<string>>(() => new Set(task?.assigneeIds ?? []));
  const [errors, setErrors] = useState<TaskDraftErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const { busy, run } = useBusyAction();

  const set = (patch: Partial<TaskDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const eventOptions = [
    { value: '', label: 'No event' },
    ...events.map((e) => ({ value: e.id, label: `${e.title} · ${formatRangeIn(e.startsAt, e.endsAt, e.timezone)}` })),
  ];

  function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateTaskDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const input = {
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      dueAt: draft.dueDate ? zonedToEpoch(draft.dueDate, draft.dueMinute, timezone) : null,
      linkUrl: draft.linkUrl,
      eventId: eventId || null,
    };

    void run(async () => {
      setServerError(null);
      try {
        if (task) {
          await updateTask(task.id, input);
          const before = [...task.assigneeIds].sort().join(',');
          const after = [...assignees].sort().join(',');
          if (before !== after) await setAssignees(task.id, [...assignees]);
          onSaved('Task saved.');
        } else {
          await createTask(spaceId, input, {
            parentId: parent?.id ?? null,
            isAssignment: !parent && isAssignment,
            assigneeIds: [...assignees],
          });
          onSaved(assignees.size > 0 ? 'Task created. Assignees were notified.' : 'Task created.');
        }
      } catch (caught) {
        setServerError(messageOf(caught, 'Could not save the task.'));
      }
    });
  }

  return (
    <Card className="border-accent">
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <p className="text-sm font-semibold">
          {task ? 'Edit task' : parent ? `Add a part to “${parent.title}”` : 'New task'}
        </p>
        <TextField
          label="Task"
          placeholder={parent ? 'Write the methods section' : 'Book a study room'}
          value={draft.title}
          maxLength={TASK_TITLE_MAX}
          onChange={(e) => set({ title: e.target.value })}
          error={errors.title}
          autoFocus
        />
        {!task && !parent && (
          <CheckboxField
            label="This is an assignment I will split into parts"
            description="You can add the parts and assign them once it is created."
            checked={isAssignment}
            onChange={(e) => setIsAssignment(e.target.checked)}
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Due date (optional)" type="date" value={draft.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          <TextField
            label="Due time"
            type="time"
            disabled={!draft.dueDate}
            value={toTimeInput(draft.dueMinute)}
            onChange={(e) => {
              const minute = parseTimeInput(e.target.value);
              if (minute !== null) set({ dueMinute: minute });
            }}
          />
        </div>
        <SelectField label="Priority" value={draft.priority} onChange={(e) => set({ priority: e.target.value as TaskPriority })} options={PRIORITY_OPTIONS} />
        <fieldset className="flex flex-col">
          <legend className="text-sm font-medium text-slate-700">Who is doing it</legend>
          {members.map((member) => (
            <CheckboxField
              key={member.userId}
              label={member.userId === viewerId ? 'Me' : `@${member.profile.username}`}
              checked={assignees.has(member.userId)}
              onChange={(e) =>
                setAssigneesState((current) => {
                  const next = new Set(current);
                  if (e.target.checked) next.add(member.userId);
                  else next.delete(member.userId);
                  return next;
                })
              }
            />
          ))}
        </fieldset>
        <TextAreaField
          label="Notes (optional)"
          value={draft.description}
          maxLength={TASK_DESCRIPTION_MAX}
          onChange={(e) => set({ description: e.target.value })}
          error={errors.description}
        />
        <TextField
          label="Link (optional)"
          type="url"
          inputMode="url"
          placeholder="https://docs.google.com/…"
          value={draft.linkUrl}
          onChange={(e) => set({ linkUrl: e.target.value })}
          error={errors.linkUrl}
        />
        {eventOptions.length > 1 && (
          <SelectField label="For an event (optional)" value={eventId} onChange={(e) => setEventId(e.target.value)} options={eventOptions} />
        )}
        {serverError && <Notice tone="error">{serverError}</Notice>}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={busy}>
            {busy ? 'Saving…' : task ? 'Save' : 'Add task'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
