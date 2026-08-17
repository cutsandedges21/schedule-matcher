// src/features/friends/PendingRequests.tsx
import { useState } from 'react';
import { acceptFriendRequest, removeFriendship, type FriendRequest } from './useFriends';
import Button from '@/components/Button';

interface Props {
  requests: FriendRequest[];
  onChanged: () => void;
}

export default function PendingRequests({ requests, onChanged }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) return null;

  async function handleAccept(id: string) {
    setError(null);
    setPendingId(id);
    try {
      await acceptFriendRequest(id);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not accept that request.');
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    setPendingId(id);
    try {
      await removeFriendship(id);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update that request.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="px-4">
      <h2 className="text-sm font-semibold text-slate-500">Requests</h2>
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}

      <ul className="mt-2 flex flex-col gap-2">
        {requests.map((request) => {
          const busy = pendingId === request.id;
          return (
            <li key={request.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
              {/* min-w-0 so a long username truncates instead of shoving the
                  buttons off the right edge of a narrow phone. */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">@{request.profile.username}</p>
                <p className="text-xs text-slate-500">
                  {request.direction === 'incoming' ? 'Wants to connect' : 'Request sent'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {request.direction === 'incoming' && (
                  <Button size="sm" disabled={busy} onClick={() => void handleAccept(request.id)}>
                    {busy ? '…' : 'Accept'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void handleRemove(request.id)}
                >
                  {busy ? '…' : request.direction === 'incoming' ? 'Decline' : 'Cancel'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
