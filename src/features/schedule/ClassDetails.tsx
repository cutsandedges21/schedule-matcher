// src/features/schedule/ClassDetails.tsx
import { formatMinutes } from '@/domain/time';
import { WEEKDAY_LABELS } from '@/domain/constants';
import type { ClassMeeting } from '@/domain/types';

interface Props {
  meeting: ClassMeeting;
  onClose: () => void;
}

/**
 * The read-only card under a schedule grid for the class that was tapped.
 *
 * A block only fits its room when it is tall enough, and a phone's week view
 * drops the room entirely, so this card is where the room is always readable —
 * on your own schedule and on a friend's alike.
 */
export default function ClassDetails({ meeting, onClose }: Props) {
  const code = [meeting.courseCode, meeting.section && `sec. ${meeting.section}`]
    .filter(Boolean)
    .join(' · ');
  const days = [...meeting.days].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(', ');

  return (
    <section
      aria-label={`${meeting.name} details`}
      className="rounded-xl border border-slate-200 bg-white p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{meeting.name}</p>
          {code && <p className="text-xs text-slate-500">{code}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full px-2 text-sm text-slate-500 hover:bg-slate-100"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500">Room</dt>
        <dd className={meeting.room ? 'font-medium' : 'text-slate-400'}>
          {meeting.room ?? 'Not listed'}
        </dd>
        <dt className="text-slate-500">When</dt>
        <dd>
          {days} · {formatMinutes(meeting.startMinute)}–{formatMinutes(meeting.endMinute)}
        </dd>
        {meeting.instructor && (
          <>
            <dt className="text-slate-500">Teacher</dt>
            <dd>{meeting.instructor}</dd>
          </>
        )}
      </dl>
    </section>
  );
}
