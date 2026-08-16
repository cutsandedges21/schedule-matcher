// src/features/schedule/SchedulePage.tsx
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSchedule } from './useSchedule';
import ScheduleGrid from './ScheduleGrid';
import EmptyState from '@/components/EmptyState';
import Spinner from '@/components/Spinner';
import Button from '@/components/Button';

export default function SchedulePage() {
  const { session, profile } = useAuth();
  const { classes, loading, error } = useSchedule(session?.user.id);

  if (loading) return <Spinner label="Loading your schedule" />;

  return (
    <main>
      <header className="flex items-center justify-between px-4 pt-4">
        <div>
          <h1 className="text-2xl font-bold">My schedule</h1>
          <p className="text-sm text-slate-500">@{profile?.username}</p>
        </div>
        <Link to="/upload">
          <Button variant="secondary">{classes.length > 0 ? 'Replace' : 'Add'}</Button>
        </Link>
      </header>

      {error && <p className="px-4 pt-3 text-sm text-rose-600">{error}</p>}

      {classes.length === 0 ? (
        <EmptyState
          title="No schedule yet"
          body="Upload a screenshot of your classes and we'll turn it into a real schedule."
          action={<Link to="/upload"><Button>Upload a screenshot</Button></Link>}
        />
      ) : (
        <div className="mt-2">
          <ScheduleGrid classes={classes} />
        </div>
      )}
    </main>
  );
}
