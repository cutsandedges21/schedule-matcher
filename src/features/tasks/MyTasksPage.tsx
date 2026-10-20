// src/features/tasks/MyTasksPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAsyncData } from '@/lib/useAsyncData';
import { compareTasks, filterTasks, isOverdue, type TaskView } from '@/domain/tasks';
import { browserTimeZone } from '@/domain/zonedTime';
import { buttonClassName } from '@/components/Button';
import { Card, InlineEmpty, Notice, PageHeader } from '@/components/Layout';
import SegmentedControl from '@/components/SegmentedControl';
import Spinner from '@/components/Spinner';
import TaskItem from './TaskItem';
import { listMyTasks } from './api';
import { useTaskActions } from './useTaskActions';

const VIEWS: { value: Extract<TaskView, 'mine' | 'overdue' | 'upcoming' | 'completed'>; label: string }[] = [
  { value: 'mine', label: 'To do' },
  { value: 'upcoming', label: 'This week' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Done' },
];

/** Everything on the student's plate, from every space, in deadline order. */
export default function MyTasksPage() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const tasks = useAsyncData(() => listMyTasks(userId), [userId], 'Could not load your tasks.');
  const actions = useTaskActions(tasks, userId);
  const [view, setView] = useState<(typeof VIEWS)[number]['value']>('mine');
  const [expanded, setExpanded] = useState<string | null>(null);
  const zone = browserTimeZone();
  const now = Date.now();

  if (tasks.loading && !tasks.data) return <Spinner label="Loading your tasks" />;

  const all = tasks.data ?? [];
  const list = filterTasks(all, view, userId, now).sort(compareTasks(now));
  const overdueCount = all.filter((t) => isOverdue(t, now)).length;

  return (
    <main className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <PageHeader title="Tasks" subtitle="Assigned to you, across all your spaces" />

      <SegmentedControl
        label="Which tasks"
        options={VIEWS.map((v) => ({ ...v, count: v.value === 'overdue' ? overdueCount : undefined }))}
        value={view}
        onChange={setView}
      />

      {tasks.error && <Notice tone="warning">{tasks.error}</Notice>}

      {list.length === 0 && !tasks.error ? (
        all.length === 0 ? (
          <Card className="flex flex-col items-start gap-2">
            <p className="text-sm text-slate-700">
              Nothing is assigned to you yet. Tasks you take on, or that someone gives you, in any space land here.
            </p>
            <Link to="/spaces" className={buttonClassName('secondary', undefined, 'sm')}>
              Go to your spaces
            </Link>
          </Card>
        ) : (
          <InlineEmpty>{view === 'overdue' ? 'Nothing overdue.' : view === 'completed' ? 'Nothing finished yet.' : 'All clear.'}</InlineEmpty>
        )
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((task) => (
            <li key={task.id}>
              <TaskItem
                task={task}
                viewerId={userId}
                // Your own assignment gives edit rights whatever your role, and
                // nothing on this screen needs a manager's.
                role="member"
                labelOf={(id) => (id === userId ? 'You' : 'a teammate')}
                timezone={zone}
                nowMs={now}
                expanded={expanded === task.id}
                onToggleExpanded={() => setExpanded(expanded === task.id ? null : task.id)}
                onSetStatus={actions.setStatus}
                onDelete={(t) => void actions.remove(t)}
                context={task.spaceName}
                eventHref={task.eventId ? `/spaces/${task.spaceId}/events/${task.eventId}` : null}
                busy={actions.busy}
              />
              {expanded === task.id && (
                <Link to={`/spaces/${task.spaceId}/tasks?task=${task.id}`} className="mt-1 block px-3 text-xs font-medium underline">
                  Open in {task.spaceName ?? 'its space'} to edit
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
