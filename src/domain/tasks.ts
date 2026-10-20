// src/domain/tasks.ts
//
// Shared tasks (migration 0018). Assignments are top-level tasks whose
// subtasks divide the work; there is one level of nesting, enforced by the
// database.
import type { SpaceRole } from './spaces';
import { isWebUrl } from './events';
import { DAY_MS } from './zonedTime';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskView = 'all' | 'mine' | 'upcoming' | 'overdue' | 'completed';

export interface SpaceTask {
  id: string;
  spaceId: string;
  parentId: string | null;
  isAssignment: boolean;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Epoch ms, or null for no deadline. */
  dueAt: number | null;
  eventId: string | null;
  linkUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  completedBy: string | null;
  assigneeIds: string[];
}

export const TASK_TITLE_MAX = 200;
export const TASK_DESCRIPTION_MAX = 4000;
/** "Upcoming" reaches this far ahead. */
export const UPCOMING_DAYS = 7;

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const VIEW_LABELS: Record<TaskView, string> = {
  all: 'All',
  mine: 'Mine',
  upcoming: 'Upcoming',
  overdue: 'Overdue',
  completed: 'Done',
};

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function isOverdue(task: Pick<SpaceTask, 'status' | 'dueAt'>, nowMs: number): boolean {
  return task.status !== 'done' && task.dueAt !== null && task.dueAt < nowMs;
}

export function isAssignedTo(task: Pick<SpaceTask, 'assigneeIds'>, userId: string): boolean {
  return task.assigneeIds.includes(userId);
}

/**
 * Which tasks a view shows. Done tasks appear only under "Done": a finished
 * task in "Mine" is noise, and keeping them out is what lets the other views
 * read as a to-do list.
 */
export function filterTasks<T extends SpaceTask>(tasks: readonly T[], view: TaskView, userId: string, nowMs: number): T[] {
  switch (view) {
    case 'completed':
      return tasks.filter((t) => t.status === 'done');
    case 'all':
      return tasks.filter((t) => t.status !== 'done');
    case 'mine':
      return tasks.filter((t) => t.status !== 'done' && isAssignedTo(t, userId));
    case 'overdue':
      return tasks.filter((t) => isOverdue(t, nowMs));
    case 'upcoming':
      return tasks.filter(
        (t) => t.status !== 'done' && t.dueAt !== null && t.dueAt >= nowMs && t.dueAt <= nowMs + UPCOMING_DAYS * DAY_MS
      );
  }
}

/**
 * Overdue first, then by deadline (soonest first, undated last), then by
 * priority, then oldest first. Done tasks sort by when they were finished,
 * newest first.
 */
export function compareTasks(nowMs: number) {
  return (a: SpaceTask, b: SpaceTask): number => {
    if (a.status === 'done' && b.status === 'done') {
      return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
    }
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
    const overdue = Number(isOverdue(b, nowMs)) - Number(isOverdue(a, nowMs));
    if (overdue !== 0) return overdue;
    if (a.dueAt !== b.dueAt) {
      if (a.dueAt === null) return 1;
      if (b.dueAt === null) return -1;
      return a.dueAt - b.dueAt;
    }
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt);
  };
}

export interface Progress {
  done: number;
  total: number;
  /** 0–100, rounded down so "100%" means really finished. */
  percent: number;
}

/** An assignment's progress is its subtasks'; one without subtasks is 0 or 100 by its own status. */
export function assignmentProgress(assignment: SpaceTask, all: readonly SpaceTask[]): Progress {
  const parts = all.filter((t) => t.parentId === assignment.id);
  if (parts.length === 0) {
    const done = assignment.status === 'done' ? 1 : 0;
    return { done, total: 1, percent: done * 100 };
  }
  const done = parts.filter((t) => t.status === 'done').length;
  return { done, total: parts.length, percent: Math.floor((done / parts.length) * 100) };
}

/** space_tasks_update: creator, an assignee, or a manager. */
export function canEditTask(task: Pick<SpaceTask, 'createdBy' | 'assigneeIds'>, userId: string, role: SpaceRole): boolean {
  return task.createdBy === userId || task.assigneeIds.includes(userId) || role === 'owner' || role === 'admin';
}

/** space_tasks_delete: creator or a manager. */
export function canDeleteTask(task: Pick<SpaceTask, 'createdBy'>, userId: string, role: SpaceRole): boolean {
  return task.createdBy === userId || role === 'owner' || role === 'admin';
}

export interface TaskDraft {
  title: string;
  description: string;
  priority: TaskPriority;
  /** 'YYYY-MM-DD' or '' for no deadline. */
  dueDate: string;
  /** Minutes from midnight; used only with a dueDate. */
  dueMinute: number;
  linkUrl: string;
}

export type TaskDraftErrors = Partial<Record<keyof TaskDraft, string>>;

export function validateTaskDraft(draft: TaskDraft): TaskDraftErrors {
  const errors: TaskDraftErrors = {};
  const title = draft.title.trim();
  if (!title) errors.title = 'Give the task a name.';
  else if (title.length > TASK_TITLE_MAX) errors.title = `At most ${TASK_TITLE_MAX} characters.`;
  if (draft.description.length > TASK_DESCRIPTION_MAX) errors.description = `At most ${TASK_DESCRIPTION_MAX} characters.`;
  if (draft.linkUrl.trim() && !isWebUrl(draft.linkUrl)) errors.linkUrl = 'Paste a full link starting with https://';
  return errors;
}

/** "Lab report: 3 of 5 done" style, for screen readers and summaries. */
export function progressLabel(progress: Progress): string {
  return `${progress.done} of ${progress.total} done`;
}
