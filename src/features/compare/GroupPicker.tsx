// src/features/compare/GroupPicker.tsx
import { MAX_GROUP_FRIENDS } from '@/domain/constants';
import type { Profile } from '@/domain/types';

interface Props {
  friends: Profile[];
  selected: string[];
  onToggle: (username: string) => void;
}

export default function GroupPicker({ friends, selected, onToggle }: Props) {
  const full = selected.length >= MAX_GROUP_FRIENDS;

  return (
    <section className="px-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-500">Who to compare</h2>
        <span className="text-xs text-slate-400">
          {selected.length} of {MAX_GROUP_FRIENDS}
        </span>
      </div>

      <ul className="mt-2 flex flex-col gap-2">
        {friends.map((friend) => {
          const checked = selected.includes(friend.username);
          // A full group must still let you untick someone, or the only way
          // out of a wrong pick is to reload the page.
          const disabled = full && !checked;

          return (
            <li key={friend.id}>
              <label
                className={`flex min-h-touch items-center gap-3 rounded-xl border bg-white p-3 ${
                  checked ? 'border-slate-900' : 'border-slate-200'
                } ${disabled ? 'opacity-40' : ''}`}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-slate-900"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(friend.username)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">@{friend.username}</span>
                  {friend.displayName && (
                    <span className="block truncate text-sm text-slate-500">{friend.displayName}</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {full && (
        <p className="mt-2 text-xs text-slate-500">
          That's the maximum. Untick someone to swap them out.
        </p>
      )}
    </section>
  );
}
