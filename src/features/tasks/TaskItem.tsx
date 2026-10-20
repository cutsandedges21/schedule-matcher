// src/features/tasks/TaskItem.tsx
import { Link } from 'react-router-dom';
import {
  canDeleteTask,
  canEditTask,
  isOverdue,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type SpaceTask,
  type TaskStatus,
} from '@/domain/tasks';
import { relativeDue } from '@/domain/relativeTime';
import { formatInstantIn } from '@/domain/zonedTime';
import type { SpaceRole } from '@/domain/spaces';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import { Badge } from '@/components/Layout';

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as TaskStatus[]).map((value) => ({ value, label: STATUS_LABELS[value] }));

export interface TaskItemProps {
  task: SpaceTask;
  viewerId: string;
  role: SpaceRole;
  labelOf: (userId: string) => string;
  timezone: string;
  nowMs: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSetStatus: (task: SpaceTask, status: TaskStatus) => void;
  /** Omitted where the full assignee list is not loaded (My Tasks): claiming would overwrite it. */
  onToggleMine?: (task: SpaceTask) => void;
  /** Omitted where the edit form cannot open (My Tasks links to the space instead). */
  onEdit?: (task: SpaceTask) => void;
  onDelete: (task: SpaceTask) => void;
  /** "Lab report" — shown on subtasks listed outside their assignment. */
  context?: string | null;
  eventHref?: string | null;
  busy: boolean;
}

export default function TaskItem(props: TaskItemProps) {
  const { task, viewerId, role, labelOf, timezone, nowMs, expanded, busy } = props;
  const done = task.status === 'done';
  const overdue = isOverdue(task, nowMs);
  const editable = canEditTask(task, viewerId, role);
  const mine = task.assigneeIds.includes(viewerId);

  return (
    <div id={`task-${task.id}`} className={`rounded-xl border bg-white ${overdue ? 'border-rose-300' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3 p-3">
        <input
          type="checkbox"
          checked={done}
          disabled={!editable || busy}
          onChange={() => props.onSetStatus(task, done ? 'todo' : 'done')}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          className="mt-0.5 h-5 w-5 shrink-0 accent-slate-900"
        />
        <button type="button" onClick={props.onToggleExpanded} aria-expanded={expanded} className="min-w-0 flex-1 text-left">
          {props.context && <span className="block truncate text-xs text-slate-500">{props.context}</span>}
          <span className={`block text-sm font-semibold ${done ? 'text-slate-500 line-through' : ''}`}>{task.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {task.status === 'in_progress' && <Badge tone="sky">In progress</Badge>}
            {(task.priority === 'high' || task.priority === 'urgent') && !done && (
              <Badge tone={task.priority === 'urgent' ? 'rose' : 'amber'}>{PRIORITY_LABELS[task.priority]}</Badge>
            )}
            {task.dueAt !== null && !done && (
              <span className={overdue ? 'font-semibold text-rose-700' : ''}>
                {overdue ? `Overdue · was due ${relativeDue(task.dueAt, nowMs).replace(' overdue', ' ago')}` : `Due ${relativeDue(task.dueAt, nowMs)}`}
              </span>
            )}
            {task.assigneeIds.length > 0 && (
              <span className="flex items-center gap-1">
                {task.assigneeIds.slice(0, 4).map((id) => (
                  <Avatar key={id} username={labelOf(id).replace(/^@/, '')} size="sm" />
                ))}
                {task.assigneeIds.length > 4 && <span>+{task.assigneeIds.length - 4}</span>}
              </span>
            )}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-slate-100 px-3 pb-3 pt-2 text-sm">
          {task.dueAt !== null && <p className="text-slate-600">Due {formatInstantIn(task.dueAt, timezone)}</p>}
          {task.description && <p className="whitespace-pre-line text-slate-700">{task.description}</p>}
          {task.linkUrl && (
            <a href={task.linkUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
              Open link ↗
            </a>
          )}
          {props.eventHref && (
            <Link to={props.eventHref} className="font-medium underline">
              Related event
            </Link>
          )}
          <p className="text-xs text-slate-500">
            {task.assigneeIds.length > 0 ? `Assigned to ${task.assigneeIds.map(labelOf).join(', ')}` : 'Nobody has taken this on yet.'}
            {task.createdBy && ` · Added by ${labelOf(task.createdBy)}`}
            {done && task.completedBy && ` · Finished by ${labelOf(task.completedBy)}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {editable && (
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                Status
                <select
                  value={task.status}
                  disabled={busy}
                  onChange={(e) => props.onSetStatus(task, e.target.value as TaskStatus)}
                  className="min-h-touch rounded-lg border border-slate-300 bg-white px-2 text-sm"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {props.onToggleMine && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => props.onToggleMine?.(task)}>
                {mine ? 'Drop it' : 'Take this on'}
              </Button>
            )}
            {editable && props.onEdit && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => props.onEdit?.(task)}>
                Edit
              </Button>
            )}
            {canDeleteTask(task, viewerId, role) && (
              <Button size="sm" variant="ghost" className="text-rose-700" disabled={busy} onClick={() => props.onDelete(task)}>
                Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
