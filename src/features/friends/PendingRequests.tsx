// src/features/friends/PendingRequests.tsx
import { acceptFriendRequest, removeFriendship, type FriendRequest } from './useFriends';
import Button from '@/components/Button';

interface Props {
  requests: FriendRequest[];
  onChanged: () => void;
}

export default function PendingRequests({ requests, onChanged }: Props) {
  if (requests.length === 0) return null;

  return (
    <section className="px-4">
      <h2 className="text-sm font-semibold text-slate-500">Requests</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {requests.map((request) => (
          <li key={request.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <p className="font-semibold">@{request.profile.username}</p>
              <p className="text-xs text-slate-500">
                {request.direction === 'incoming' ? 'Wants to connect' : 'Request sent'}
              </p>
            </div>
            <div className="flex gap-2">
              {request.direction === 'incoming' && (
                <Button onClick={async () => { await acceptFriendRequest(request.id); onChanged(); }}>
                  Accept
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={async () => { await removeFriendship(request.id); onChanged(); }}
              >
                {request.direction === 'incoming' ? 'Decline' : 'Cancel'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
