// src/features/calendar/AgendaList.tsx
import { Link } from 'react-router-dom';
import { epochToZoned, formatDateKey, formatTimeIn, type DateKey } from '@/domain/zonedTime';
import { Badge, InlineEmpty } from '@/components/Layout';

export type AgendaTone = 'event' | 'cancelled' | 'proposed' | 'class';

export interface AgendaItem {
  key: string;
  start: number;
  end: number;
  title: string;
  detail?: string | null;
  href?: string;
  tone: AgendaTone;
  badge?: { text: string; tone: 'slate' | 'amber' | 'rose' | 'emerald' | 'sky' | 'violet' };
}

/**
 * Confirmed, cancelled and merely proposed times must never look alike — a
 * student who sees a poll option styled as an event will turn up to it. So
 * each tone differs in more than colour: proposed times are dashed and
 * labelled, cancelled ones are struck through and labelled, classes are quiet
 * grey with no border.
 */
const TONES: Record<AgendaTone, string> = {
  event: 'border border-slate-200 bg-white',
  cancelled: 'border border-slate-200 bg-slate-50 text-slate-500',
  proposed: 'border-2 border-dashed border-amber-300 bg-amber-50',
  class: 'bg-slate-100 text-slate-600',
};

export default function AgendaList({
  items,
  timeZone,
  today,
  emptyText,
}: {
  items: readonly AgendaItem[];
  timeZone: string;
  today: DateKey;
  emptyText: string;
}) {
  if (items.length === 0) return <InlineEmpty>{emptyText}</InlineEmpty>;

  const byDate = new Map<DateKey, AgendaItem[]>();
  for (const item of [...items].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const date = epochToZoned(item.start, timeZone).date;
    byDate.set(date, [...(byDate.get(date) ?? []), item]);
  }

  return (
    <ol className="flex flex-col gap-4">
      {[...byDate.entries()].map(([date, dayItems]) => (
        <li key={date}>
          <h3 className="mb-1.5 text-sm font-semibold text-slate-700">
            {formatDateKey(date, 'long')}
            {date === today && <span className="ml-2 text-xs font-bold uppercase text-accent">Today</span>}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {dayItems.map((item) => {
              const body = (
                <div className={`flex items-start gap-3 rounded-xl px-3 py-2 ${TONES[item.tone]}`}>
                  <span className="w-[4.5rem] shrink-0 pt-0.5 text-xs font-semibold text-slate-500">
                    {formatTimeIn(item.start, timeZone)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold ${item.tone === 'cancelled' ? 'line-through' : ''}`}>
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      until {formatTimeIn(item.end, timeZone)}
                      {item.detail ? ` · ${item.detail}` : ''}
                    </span>
                  </span>
                  {item.tone === 'proposed' && <Badge tone="amber">Proposed</Badge>}
                  {item.tone === 'cancelled' && <Badge tone="rose">Cancelled</Badge>}
                  {item.badge && item.tone !== 'cancelled' && <Badge tone={item.badge.tone}>{item.badge.text}</Badge>}
                </div>
              );
              return (
                <li key={item.key}>
                  {item.href ? (
                    <Link to={item.href} className="block active:opacity-80">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
