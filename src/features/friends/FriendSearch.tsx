// src/features/friends/FriendSearch.tsx
import { useEffect, useRef, useState } from 'react';
import { searchProfiles, sendFriendRequest } from './useFriends';
import Button from '@/components/Button';
import type { Profile } from '@/domain/types';

interface Props {
  userId: string;
  onSent: () => void;
}

const DEBOUNCE_MS = 300;

export default function FriendSearch({ userId, onSent }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    const mySequence = ++sequence.current;
    const timer = setTimeout(() => {
      searchProfiles(query, userId)
        .then((found) => {
          // Stale-response guard: on cellular, requests for "ale" and
          // "alexis" routinely return out of order. Only apply the response
          // that matches the most recently fired search — otherwise the
          // list can show results for an earlier query while the field
          // reads something else, and the student adds the wrong person.
          if (sequence.current === mySequence) setResults(found);
        })
        .catch((error: unknown) => {
          if (sequence.current !== mySequence) return;
          setMessage(error instanceof Error ? error.message : 'Could not search right now.');
          setResults([]);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, userId]);

  function handleChange(value: string) {
    setQuery(value);
    setMessage(null);
  }

  async function handleSend(target: Profile) {
    try {
      await sendFriendRequest(userId, target.id);
      setMessage(`Request sent to @${target.username}.`);
      setResults(results.filter((r) => r.id !== target.id));
      onSent();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send that request.');
    }
  }

  return (
    <section className="px-4">
      <label htmlFor="search" className="text-xs font-medium text-slate-500">Find by username</label>
      <input
        id="search"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="username"
        className="min-h-touch mt-1 w-full rounded-xl border border-slate-300 px-3"
      />

      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}

      <ul className="mt-2 flex flex-col gap-2">
        {results.map((profile) => (
          <li key={profile.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <p className="font-semibold">@{profile.username}</p>
              {profile.displayName && <p className="text-sm text-slate-500">{profile.displayName}</p>}
            </div>
            <Button variant="secondary" onClick={() => void handleSend(profile)}>Add</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
