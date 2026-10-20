// src/features/tasks/SpaceTasksPage.tsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsyncData } from '@/lib/useAsyncData';
import {
  assignmentProgress,
  compareTasks,
  filterTasks,
  progressLabel,
  VIEW_LABELS,
  type SpaceTask,
  type TaskView,
} from '@/domain/tasks';
import Button from '@/components/Button';
import Icon from '@/components/Icon';
import { Card, InlineEmpty, Notice } from '@/components/Layout';
import SegmentedControl from '@/components/SegmentedControl';
import Spinner from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { useSpace } from '@/features/spaces/SpaceLayout';
import { listSpaceEvents } from '@/features/events/api';
import { listSpaceTasks } from './api';
import TaskForm from './TaskForm';
import TaskItem from './TaskItem';
import { useTaskActions } from './useTaskActions';

const VIEWS: TaskView[] = ['all', 'mine', 'upcoming', 'overdue', 'completed'];

type Editor = { mode: 'create'; parent: SpaceTask | null } | { mode: 'edit'; task: SpaceTask } | null;

export default function SpaceTasksPage() {
  const { space, members, me } = useSpace();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tasks = useAsyncData(() => listSpaceTasks(space.id), [space.id], 'Could not load the tasks.');
  const events = useAsyncData(
    () => listSpaceEvents(space.id, new Date().toISOString(), new Date(Date.now() + 120 * 86_400_000).toISOString()),
    [space.id],
    'Could not load events.'
  );
  const actions = useTaskActions(tasks, me.userId);
  const [view, setView] = useState<TaskView>('all');
  const [expanded, setExpanded] = useState<string | null>(params.get('task'));
  const [editor, setEditor] = useState<Editor>(params.get('new') ? { mode: 'create', parent: null } : null);
  const presetEventId = params.get('event');

  // A notification links to ?task=<id>: open it and bring it into view once loaded.
  const focus = params.get('task');
  useEffect(() => {
    if (!focus || !tasks.data) return;
    const target = tasks.data.find((t) => t.id === focus);
    if (target?.status === 'done') setView('completed');
    setExpanded(focus);
    requestAnimationFrame(() => document.getElementById(`task-${focus}`)?.scrollIntoView({ block: 'center' }));
  }, [focus, tasks.data]);

  const now = Date.now();
  const all = tasks.data ?? [];
  const labelOf = (id: string) =>
    id === me.userId ? 'You' : `@${members.find((m) => m.userId === id)?.profile.username ?? 'former member'}`;
  const parentTitle = (task: SpaceTask) => (task.parentId ? all.find((t) => t.id === task.parentId)?.title ?? null : null);

  function closeEditor(message?: string) {
    setEditor(null);
    if (params.get('new') || params.get('event')) setParams({}, { replace: true });
    if (message) {
      toast(message);
      void tasks.reload();
    }
  }

  const itemProps = (task: SpaceTask, context?: string | null) => ({
    task,
    viewerId: me.userId,
    role: me.role,
    labelOf,
    timezone: space.timezone,
    nowMs: now,
    expanded: expanded === task.id,
    onToggleExpanded: () => setExpanded(expanded === task.id ? null : task.id),
    onSetStatus: actions.setStatus,
    onToggleMine: actions.toggleMine,
    onEdit: (t: SpaceTask) => setEditor({ mode: 'edit', task: t }),
    onDelete: (t: SpaceTask) => void actions.remove(t),
    context,
    eventHref: task.eventId ? `/spaces/${space.id}/events/${task.eventId}` : null,
    busy: actions.busy,
  });

  const counts: Partial<Record<TaskView, number>> = {
    mine: filterTasks(all, 'mine', me.userId, now).length,
    overdue: filterTasks(all, 'overdue', me.userId, now).length,
  };

  const renderEditor = () =>
    editor && (
      <TaskForm
        spaceId={space.id}
        timezone={space.timezone}
        members={members}
        viewerId={me.userId}
        events={events.data ?? []}
        task={editor.mode === 'edit' ? editor.task : undefined}
        parent={editor.mode === 'create' ? editor.parent : null}
        presetEventId={editor.mode === 'create' ? presetEventId : null}
        onSaved={(message) => closeEditor(message)}
        onCancel={() => closeEditor()}
      />
    );

  if (tasks.loading && !tasks.data) return <Spinner inline label="Loading tasks" />;

  // "All": assignments as cards holding their parts, then loose tasks.
  const topLevel = all.filter((t) => t.parentId === null);
  const assignments = topLevel.filter((t) => t.isAssignment || all.some((c) => c.parentId === t.id));
  const openAssignments = assignments.filter((a) => a.status !== 'done' || all.some((c) => c.parentId === a.id && c.status !== 'done'));
  const loose = filterTasks(topLevel.filter((t) => !assignments.includes(t)), 'all', me.userId, now).sort(compareTasks(now));
  const flat = filterTasks(all, view, me.userId, now).sort(compareTasks(now));

  return (
    <div className="flex flex-col gap-4">
      {editor?.mode !== 'create' || editor.parent ? (
        <Button onClick={() => setEditor({ mode: 'create', parent: null })} className="gap-1">
          <Icon name="plus" className="h-4 w-4" /> New task or assignment
        </Button>
      ) : null}
      {editor && (editor.mode === 'edit' || !editor.parent) && renderEditor()}

      <SegmentedControl
        label="Which tasks"
        options={VIEWS.map((v) => ({ value: v, label: VIEW_LABELS[v], count: counts[v] }))}
        value={view}
        onChange={setView}
      />

      {tasks.error && <Notice tone="warning">{tasks.error}</Notice>}

      {view === 'all' ? (
        <>
          {openAssignments.map((assignment) => {
            const progress = assignmentProgress(assignment, all);
            const parts = all.filter((t) => t.parentId === assignment.id).sort(compareTasks(now));
            return (
              <Card key={assignment.id} className="flex flex-col gap-2 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assignment</p>
                  <p className="text-xs text-slate-500">{progressLabel(progress)}</p>
                </div>
                <TaskItem {...itemProps(assignment)} />
                <div
                  role="progressbar"
                  aria-label={`${assignment.title}: ${progressLabel(progress)}`}
                  aria-valuenow={progress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 overflow-hidden rounded-full bg-slate-200"
                >
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.percent}%` }} />
                </div>
                <ul className="flex flex-col gap-1.5 pl-3">
                  {parts.map((part) => (
                    <li key={part.id}>
                      <TaskItem {...itemProps(part)} />
                    </li>
                  ))}
                </ul>
                {editor?.mode === 'create' && editor.parent?.id === assignment.id ? (
                  renderEditor()
                ) : (
                  <Button size="sm" variant="ghost" className="self-start" onClick={() => setEditor({ mode: 'create', parent: assignment })}>
                    + Add a part
                  </Button>
                )}
              </Card>
            );
          })}

          {loose.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {loose.map((task) => (
                <li key={task.id}>
                  <TaskItem {...itemProps(task)} />
                </li>
              ))}
            </ul>
          ) : (
            openAssignments.length === 0 && (
              <InlineEmpty>No open tasks. Add one, or split an assignment into parts and hand them out.</InlineEmpty>
            )
          )}
        </>
      ) : flat.length === 0 ? (
        <InlineEmpty>
          {view === 'overdue'
            ? 'Nothing overdue.'
            : view === 'mine'
              ? 'Nothing assigned to you here.'
              : view === 'upcoming'
                ? 'Nothing due in the next 7 days.'
                : 'No finished tasks yet.'}
        </InlineEmpty>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {flat.map((task) => (
            <li key={task.id}>
              <TaskItem {...itemProps(task, parentTitle(task))} />
            </li>
          ))}
        </ul>
      )}

      {view !== 'overdue' && counts.overdue ? (
        <p className="text-xs text-slate-500">
          {counts.overdue} {counts.overdue === 1 ? 'task is' : 'tasks are'} past due.{' '}
          <button type="button" className="underline" onClick={() => setView('overdue')}>
            Show {counts.overdue === 1 ? 'it' : 'them'}
          </button>
        </p>
      ) : null}
    </div>
  );
}
