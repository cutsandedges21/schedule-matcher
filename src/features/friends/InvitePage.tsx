// src/features/friends/InvitePage.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { findProfileByInviteCode, acceptInvite } from './useFriends';
import Spinner from '@/components/Spinner';
import Button from '@/components/Button';
import type { Profile } from '@/domain/types';

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const { session, profile } = useAuth();
  const [target, setTarget] = useState<Profile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepted' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const found = await findProfileByInviteCode(code!);
        if (!found) {
          setMessage('That invite link is not valid.');
          setStatus('error');
          return;
        }
        if (found.id === session?.user.id) {
          setMessage('That is your own invite link.');
          setStatus('error');
          return;
        }
        setTarget(found);
        setStatus('ready');
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : 'Could not check that invite link.');
        setStatus('error');
      }
    }
    void run();
  }, [code, session?.user.id]);

  async function handleAccept() {
    try {
      await acceptInvite(code!);
      setStatus('accepted');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not use that invite link.');
      setStatus('error');
    }
  }

  if (status === 'loading') return <Spinner label="Checking that link" />;

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 p-6 text-center">
      {status === 'error' && <p className="text-slate-700">{message}</p>}

      {status === 'ready' && target && (
        <>
          <p className="text-lg">
            Connect with <span className="font-bold">@{target.username}</span>?
          </p>
          <Button onClick={() => void handleAccept()}>Add friend</Button>
        </>
      )}

      {status === 'accepted' && target && (
        <p className="text-lg">You and @{target.username} are now friends.</p>
      )}

      <Link
        to="/friends"
        className="flex min-h-touch items-center justify-center px-4 text-sm text-slate-500 underline"
      >
        {profile ? 'Back to friends' : 'Continue'}
      </Link>
    </main>
  );
}
