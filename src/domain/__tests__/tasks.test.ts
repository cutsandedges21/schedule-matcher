// src/domain/__tests__/tasks.test.ts
import { describe, it, expect } from 'vitest';
import {
  assignmentProgress,
  canDeleteTask,
  canEditTask,
  compareTasks,
  filterTasks,
  isOverdue,
  validateTaskDraft,
  type SpaceTask,
} from '../tasks';

const NOW = Date.parse('2026-10-20T12:00:00Z');
const HOUR = 3_600_000;

function task(id: string, over: Partial<SpaceTask> = {}): SpaceTask {
  return {
    id,
    spaceId: 's',
    parentId: null,
    isAssignment: false,
    title: id,
    description: null,
    status: 'todo',
    priority: 'normal',
    dueAt: null,
    eventId: null,
    linkUrl: null,
    createdBy: 'creator',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    completedAt: null,
    completedBy: null,
    assigneeIds: [],
    ...over,
  };
}

const overdue = task('overdue', { dueAt: NOW - HOUR, assigneeIds: ['me'] });
const soon = task('soon', { dueAt: NOW + 2 * HOUR });
const later = task('later', { dueAt: NOW + 20 * 24 * HOUR, assigneeIds: ['me'] });
const undated = task('undated', { priority: 'urgent' });
const done = task('done', { status: 'done', dueAt: NOW - 48 * HOUR, completedAt: '2026-10-19T00:00:00Z', assigneeIds: ['me'] });
const all = [overdue, soon, later, undated, done];

describe('filterTasks', () => {
  const ids = (view: Parameters<typeof filterTasks>[1]) => filterTasks(all, view, 'me', NOW).map((t) => t.id);

  it('keeps done tasks out of every view but Done', () => {
    expect(ids('all')).toEqual(['overdue', 'soon', 'later', 'undated']);
    expect(ids('completed')).toEqual(['done']);
  });

  it('shows only my open tasks under Mine', () => {
    expect(ids('mine')).toEqual(['overdue', 'later']);
  });

  it('separates overdue from the coming week', () => {
    expect(ids('overdue')).toEqual(['overdue']);
    expect(ids('upcoming')).toEqual(['soon']);
  });

  it('never calls a finished task overdue', () => {
    expect(isOverdue(done, NOW)).toBe(false);
    expect(isOverdue(overdue, NOW)).toBe(true);
  });
});

describe('compareTasks', () => {
  it('puts overdue first, then by deadline, undated after dated, done last', () => {
    expect([...all].sort(compareTasks(NOW)).map((t) => t.id)).toEqual(['overdue', 'soon', 'later', 'undated', 'done']);
  });

  it('breaks a deadline tie by priority', () => {
    const a = task('a', { dueAt: NOW + HOUR, priority: 'low' });
    const b = task('b', { dueAt: NOW + HOUR, priority: 'high' });
    expect([a, b].sort(compareTasks(NOW)).map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('assignmentProgress', () => {
  it('counts finished subtasks', () => {
    const report = task('report', { isAssignment: true });
    const parts = [
      task('intro', { parentId: 'report', status: 'done' }),
      task('methods', { parentId: 'report', status: 'in_progress' }),
      task('results', { parentId: 'report' }),
    ];
    expect(assignmentProgress(report, [report, ...parts])).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it('uses the assignment’s own status when it has no subtasks', () => {
    expect(assignmentProgress(task('x', { status: 'done' }), []).percent).toBe(100);
    expect(assignmentProgress(task('y'), []).percent).toBe(0);
  });
});

describe('permissions', () => {
  it('mirrors space_tasks_update and _delete', () => {
    const t = task('t', { createdBy: 'c', assigneeIds: ['a'] });
    expect(canEditTask(t, 'c', 'member')).toBe(true);
    expect(canEditTask(t, 'a', 'member')).toBe(true);
    expect(canEditTask(t, 'x', 'member')).toBe(false);
    expect(canEditTask(t, 'x', 'admin')).toBe(true);
    expect(canDeleteTask(t, 'a', 'member')).toBe(false);
    expect(canDeleteTask(t, 'c', 'member')).toBe(true);
    expect(canDeleteTask(t, 'x', 'owner')).toBe(true);
  });
});

describe('validateTaskDraft', () => {
  const ok = { title: 'Draft intro', description: '', priority: 'normal' as const, dueDate: '', dueMinute: 0, linkUrl: '' };
  it('accepts a plain task and refuses what the database would', () => {
    expect(validateTaskDraft(ok)).toEqual({});
    expect(validateTaskDraft({ ...ok, title: '  ' }).title).toBeDefined();
    expect(validateTaskDraft({ ...ok, title: 'x'.repeat(201) }).title).toMatch(/200/);
    expect(validateTaskDraft({ ...ok, linkUrl: 'not a link' }).linkUrl).toBeDefined();
  });
});
