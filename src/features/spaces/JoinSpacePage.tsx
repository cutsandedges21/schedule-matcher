// src/features/spaces/JoinSpacePage.tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAsyncData } from '@/lib/useAsyncData';
import { messageOf } from '@/lib/supabaseErrors';
import { useBusyAction } from '@/lib/useBusyAction';
import { inviteStatusMessage, spaceKindLabel } from '@/domain/spaces';
import Button, { buttonClassName } from '@/components/Button';
import Spinner from '@/components/Spinner';
import { Notice } from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { joinWithCode, previewInvite } from './api';

/**
 * Where an invite link lands. Signed-out students arrive here after sign-in
 * and onboarding — RequireAuth remembers the path across the OAuth round trip,
 * the same way it does for /invite/:username.
 */
export default function JoinSpacePage() {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const preview = useAsyncData(() => previewInvite(code), [code], 'Could not check that invite link.');
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusyAction();

  function join() {
    void run(async () => {
      setError(null);
      try {
        const spaceId = await joinWithCode(code);
        toast(`Welcome to ${preview.data?.name ?? 'the space'}.`);
        navigate(`/spaces/${spaceId}`, { replace: true });
      } catch (caught) {
        setError(messageOf(caught, 'Could not join with that link.'));
      }
    });
  }

  if (preview.loading) return <Spinner label="Checking that link" />;

  const data = preview.data;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      {preview.error && <Notice tone="error">{preview.error}</Notice>}

      {data && (data.status === 'valid' || data.status === 'member') ? (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {data.status === 'member' ? 'You are already in' : 'You are invited to'}
          </p>
          <h1 className="text-3xl font-bold">{data.name}</h1>
          <p className="text-sm text-slate-600">
            {spaceKindLabel(data.kind ?? 'group')} · {data.memberCount}{' '}
            {data.memberCount === 1 ? 'member' : 'members'}
          </p>
          {data.description && <p className="text-slate-700">{data.description}</p>}

          {data.status === 'valid' ? (
            <>
              <Notice tone="info">
                Members of this space will see <strong>when you are busy</strong>, not what you are
                doing. You can share more, or nothing at all, from the space&rsquo;s settings.
              </Notice>
              {error && <Notice tone="error">{error}</Notice>}
              <Button onClick={join} disabled={busy} className="w-full">
                {busy ? 'Joining…' : 'Join space'}
              </Button>
            </>
          ) : (
            <Link to={`/spaces/${data.spaceId}`} className={buttonClassName('primary', 'w-full')}>
              Open the space
            </Link>
          )}
        </>
      ) : (
        data && (
          <>
            <h1 className="text-2xl font-bold">This link does not work</h1>
            <p className="text-slate-700">{inviteStatusMessage(data.status)}</p>
          </>
        )
      )}

      <Link to="/spaces" className="flex min-h-touch items-center justify-center text-sm text-slate-500 underline">
        Back to your spaces
      </Link>
    </main>
  );
}
