// src/features/tasks/useTaskActions.ts
import { messageOf } from '@/lib/supabaseErrors';
import { useBusyAction } from '@/lib/useBusyAction';
import type { AsyncData } from '@/lib/useAsyncData';
import type { SpaceTask, TaskStatus } from '@/domain/tasks';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { deleteTask, setAssignees, updateTask } from './api';

/**
 * Status, claim and delete for a task list, shared by the space board and My
 * Tasks. Status changes are optimistic — a checkbox has to respond under the
 * finger — and put back if the server refuses.
 */
export function useTaskActions<T extends SpaceTask>(list: AsyncData<T[]>, viewerId: string) {
  const toast = useToast();
  const confirm = useConfirm();
  const { busy, run } = useBusyAction();

  function patchLocal(id: string, patch: Partial<SpaceTask>) {
    list.setData((current) => (current ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function setStatus(task: SpaceTask, status: TaskStatus) {
    if (task.status === status) return;
    const previous = { status: task.status, completedAt: task.completedAt, completedBy: task.completedBy };
    patchLocal(task.id, {
      status,
      completedAt: status === 'done' ? new Date().toISOString() : null,
      completedBy: status === 'done' ? viewerId : null,
    });
    void updateTask(task.id, { status }).then(
      () => {
        if (status === 'done') toast(`Done: ${task.title}`);
      },
      (caught) => {
        patchLocal(task.id, previous);
        toast(messageOf(caught, 'Could not update the task.'), 'error');
      }
    );
  }

  function toggleMine(task: SpaceTask) {
    const mine = task.assigneeIds.includes(viewerId);
    const next = mine ? task.assigneeIds.filter((id) => id !== viewerId) : [...task.assigneeIds, viewerId];
    void run(async () => {
      try {
        await setAssignees(task.id, next);
        patchLocal(task.id, { assigneeIds: next });
        toast(mine ? 'You dropped the task.' : 'The task is yours.');
      } catch (caught) {
        toast(messageOf(caught, 'Could not change who is on this task.'), 'error');
      }
    });
  }

  async function remove(task: SpaceTask) {
    const ok = await confirm({
      title: `Delete “${task.title}”?`,
      body: task.isAssignment ? 'Its parts are deleted with it.' : undefined,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    void run(async () => {
      try {
        await deleteTask(task.id);
        await list.reload();
        toast('Task deleted.', 'info');
      } catch (caught) {
        toast(messageOf(caught, 'Could not delete the task.'), 'error');
      }
    });
  }

  return { busy, setStatus, toggleMine, remove };
}
