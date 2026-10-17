// src/features/spaces/ActivityList.tsx
import { describeActivity, type ActivityItem } from '@/domain/spaceMappers';
import { relativeTime } from '@/domain/relativeTime';
import { InlineEmpty } from '@/components/Layout';

export default function ActivityList({
  items,
  viewerId,
  spaceNames,
  nowMs = Date.now(),
}: {
  items: ActivityItem[];
  viewerId: string;
  /** When given, each line is labelled with its space — the cross-space feed on Home. */
  spaceNames?: Map<string, string>;
  nowMs?: number;
}) {
  if (items.length === 0) return <InlineEmpty>Nothing has happened here yet.</InlineEmpty>;

  return (
    <ul className="flex flex-col divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
      {items.map((item) => (
        <li key={item.id} className="px-4 py-2.5 text-sm">
          <p className="text-slate-800">{describeActivity(item, viewerId)}</p>
          <p className="text-xs text-slate-500">
            {spaceNames?.get(item.spaceId) ? `${spaceNames.get(item.spaceId)} · ` : ''}
            <time dateTime={item.createdAt}>{relativeTime(Date.parse(item.createdAt), nowMs)}</time>
          </p>
        </li>
      ))}
    </ul>
  );
}
