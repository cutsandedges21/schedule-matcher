// src/features/tasks/api.ts
import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/lib/supabaseErrors';
import { TASK_COLUMNS, rowToTask, type TaskRow, type TaskWithSpace } from '@/domain/planMappers';
import type { TaskPriority, TaskStatus } from '@/domain/tasks';

export async function listSpaceTasks(spaceId: string): Promise<TaskWithSpace[]> {
  const { data, error } = await supabase
    .from('space_tasks')
    .select(TASK_COLUMNS)
    .eq('space_id', spaceId)
    .order('created_at');
  throwIfError(error, 'Could not load the tasks.');
  return ((data ?? []) as unknown as TaskRow[]).map(rowToTask);
}

/**
 * Tasks assigned to the student, across every space. The !inner join keeps
 * only tasks with a matching assignee row, so the embedded list holds just the
 * student — enough to show "yours", which is all this list needs.
 */
export async function listMyTasks(userId: string): Promise<TaskWithSpace[]> {
  const { data, error } = await supabase
    .from('space_tasks')
    .select(`${TASK_COLUMNS.replace('task_assignees(user_id)', 'task_assignees!inner(user_id)')}, space:spaces(name)`)
    .eq('task_assignees.user_id', userId)
    .order('due_at', { ascending: true, nullsFirst: false });
  throwIfError(error, 'Could not load your tasks.');
  return ((data ?? []) as unknown as TaskRow[]).map(rowToTask);
}

export interface TaskInput {
  title: string;
  description: string;
  priority: TaskPriority;
  dueAt: number | null;
  linkUrl: string;
  eventId: string | null;
}

export async function createTask(
  spaceId: string,
  input: TaskInput,
  options: { parentId: string | null; isAssignment: boolean; assigneeIds: string[] }
): Promise<string> {
  const { data, error } = await supabase.rpc('create_space_task', {
    p_space_id: spaceId,
    p_title: input.title.trim(),
    p_description: input.description,
    p_priority: input.priority,
    p_due_at: input.dueAt === null ? null : new Date(input.dueAt).toISOString(),
    p_parent_id: options.parentId,
    p_is_assignment: options.isAssignment,
    p_event_id: input.eventId,
    p_link_url: input.linkUrl,
    p_assignee_ids: options.assigneeIds,
  });
  throwIfError(error, 'Could not create the task.');
  return data as string;
}

export async function updateTask(taskId: string, patch: Partial<TaskInput> & { status?: TaskStatus }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.description !== undefined) row.description = patch.description.trim() || null;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.dueAt !== undefined) row.due_at = patch.dueAt === null ? null : new Date(patch.dueAt).toISOString();
  if (patch.linkUrl !== undefined) row.link_url = patch.linkUrl.trim() || null;
  if (patch.eventId !== undefined) row.event_id = patch.eventId;
  if (patch.status !== undefined) row.status = patch.status;

  const { data, error } = await supabase.from('space_tasks').update(row).eq('id', taskId).select('id');
  throwIfError(error, 'Could not save the task.');
  if (!data || data.length === 0) throw new Error('Only the creator, an assignee or an admin can change this task.');
}

export async function deleteTask(taskId: string): Promise<void> {
  const { data, error } = await supabase.from('space_tasks').delete().eq('id', taskId).select('id');
  throwIfError(error, 'Could not delete the task.');
  if (!data || data.length === 0) throw new Error('Only the creator or an admin can delete this task.');
}

export async function setAssignees(taskId: string, userIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_task_assignees', { p_task_id: taskId, p_user_ids: userIds });
  throwIfError(error, 'Could not change who is on this task.');
}
