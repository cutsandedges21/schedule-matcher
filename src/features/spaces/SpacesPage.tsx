// src/features/spaces/SpacesPage.tsx
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAsyncData } from '@/lib/useAsyncData';
import { messageOf } from '@/lib/supabaseErrors';
import { useBusyAction } from '@/lib/useBusyAction';
import { extractInviteCode, ROLE_LABELS, spaceKindLabel } from '@/domain/spaces';
import type { MyInvitation, MySpace } from '@/domain/spaceMappers';
import { buttonClassName } from '@/components/Button';
import Button from '@/components/Button';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import { TextField } from '@/components/Field';
import { Badge, Card, Notice, PageHeader, Section } from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
import {
  acceptInvitation,
  deleteInvitation,
  listMyInvitations,
  listMySpaces,
  updateMyMembership,
} from './api';

export default function SpacesPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh: refreshBadge } = useNotifications();
  const spaces = useAsyncData(listMySpaces, [], 'Could not load your spaces.');
  const invitations = useAsyncData(listMyInvitations, [], 'Could not load your invitations.');
  const [busyInvitation, setBusyInvitation] = useState<string | null>(null);
  const { run } = useBusyAction();
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  function answer(invitation: MyInvitation, accept: boolean) {
    void run(async () => {
      setBusyInvitation(invitation.id);
      setInvitationError(null);
      try {
        if (accept) {
          const spaceId = await acceptInvitation(invitation.id);
          toast(`You joined ${invitation.spaceName}.`);
          void refreshBadge();
          navigate(`/spaces/${spaceId}`);
          return;
        }
        await deleteInvitation(invitation.id);
        toast('Invitation declined.', 'info');
        await invitations.reload();
      } catch (caught) {
        setInvitationError(messageOf(caught, 'Could not answer that invitation.'));
      } finally {
        setBusyInvitation(null);
      }
    });
  }

  async function togglePin(space: MySpace) {
    if (!session) return;
    const next = !space.pinned;
    // Optimistic: the star flips under the finger; a failure flips it back.
    spaces.setData((current) => (current ?? []).map((s) => (s.id === space.id ? { ...s, pinned: next } : s)));
    try {
      await updateMyMembership(space.id, session.user.id, { pinned: next });
    } catch (caught) {
      spaces.setData((current) => (current ?? []).map((s) => (s.id === space.id ? { ...s, pinned: !next } : s)));
      toast(messageOf(caught, 'Could not update that space.'), 'error');
    }
  }

  function join(event: FormEvent) {
    event.preventDefault();
    const code = extractInviteCode(joinInput);
    if (!code) {
      setJoinError('That does not look like an invite link. Paste the whole link you were sent.');
      return;
    }
    navigate(`/join/${code}`);
  }

  if (spaces.loading && !spaces.data) return <Spinner label="Loading your spaces" />;

  const list = [...(spaces.data ?? [])].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)
  );
  const pending = invitations.data ?? [];

  return (
    <main className="flex flex-col gap-6 px-4 pb-6 pt-4">
      <PageHeader
        title="Spaces"
        subtitle="One place per group: availability, plans, tasks and polls."
        actions={
          <Link to="/spaces/new" className={buttonClassName('primary', 'gap-1', 'sm')}>
            <Icon name="plus" className="h-4 w-4" />
            New
          </Link>
        }
      />

      {spaces.error && <Notice tone="warning">{spaces.error}</Notice>}

      {pending.length > 0 && (
        <Section title={`Invitations (${pending.length})`}>
          {invitationError && <Notice tone="error" className="mb-2">{invitationError}</Notice>}
          <ul className="flex flex-col gap-2">
            {pending.map((invitation) => {
              const busy = busyInvitation === invitation.id;
              return (
                <li key={invitation.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-accent bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{invitation.spaceName}</p>
                    <p className="text-xs text-slate-500">
                      {spaceKindLabel(invitation.spaceKind)}
                      {invitation.invitedByUsername && ` · from @${invitation.invitedByUsername}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" disabled={busy} onClick={() => answer(invitation, true)}>
                      {busy ? '…' : 'Join'}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => answer(invitation, false)}>
                      Decline
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Your spaces">
        {list.length === 0 && !spaces.error ? (
          <Card className="flex flex-col items-center gap-3 py-8 text-center">
            <Icon name="spaces" className="h-8 w-8 text-slate-400" />
            <p className="font-semibold">No spaces yet</p>
            <p className="max-w-sm text-sm text-slate-600">
              Make one for a class, a group project or your roommates. Members can find a time that
              works for everyone, plan it, split the work and vote on decisions.
            </p>
            <Link to="/spaces/new" className={buttonClassName('primary')}>
              Create your first space
            </Link>
          </Card>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {list.map((space) => (
              <li key={space.id} className="flex items-stretch rounded-2xl border border-slate-200 bg-white">
                <Link to={`/spaces/${space.id}`} className="min-w-0 flex-1 p-4 active:bg-slate-50">
                  <p className="truncate font-semibold">{space.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {spaceKindLabel(space.kind)} · {space.memberCount}{' '}
                    {space.memberCount === 1 ? 'member' : 'members'}
                  </p>
                  {space.role !== 'member' && (
                    <span className="mt-2 inline-block">
                      <Badge tone={space.role === 'owner' ? 'violet' : 'sky'}>{ROLE_LABELS[space.role]}</Badge>
                    </span>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => void togglePin(space)}
                  aria-pressed={space.pinned}
                  aria-label={space.pinned ? `Unpin ${space.name}` : `Pin ${space.name}`}
                  className={`flex min-w-touch items-start justify-center px-3 pt-4 ${space.pinned ? 'text-amber-500' : 'text-slate-300'}`}
                >
                  <Icon name="star" filled={space.pinned} className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Have an invite link?">
        <form onSubmit={join} className="flex items-start gap-2">
          <div className="flex-1">
            <TextField
              label="Invite link or code"
              hideLabel
              placeholder="Paste the link you were sent"
              value={joinInput}
              onChange={(event) => {
                setJoinInput(event.target.value);
                setJoinError(null);
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              error={joinError}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={joinInput.trim().length === 0}>
            Open
          </Button>
        </form>
      </Section>
    </main>
  );
}
