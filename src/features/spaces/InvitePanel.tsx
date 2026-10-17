// src/features/spaces/InvitePanel.tsx
import { useState, type FormEvent } from 'react';
import { useAsyncData } from '@/lib/useAsyncData';
import { messageOf } from '@/lib/supabaseErrors';
import { useBusyAction } from '@/lib/useBusyAction';
import { shareOrCopy } from '@/lib/clipboard';
import { inviteLinkState } from '@/domain/spaces';
import { browserTimeZone, epochToZoned, formatDateKey, formatTimeIn } from '@/domain/zonedTime';
import type { Space, SpaceInvite } from '@/domain/spaceMappers';
import Button from '@/components/Button';
import { SelectField, TextField } from '@/components/Field';
import { Badge, Card, Notice, Section } from '@/components/Layout';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import Avatar from '@/components/Avatar';
import {
  createSpaceInvite,
  deleteInvitation,
  inviteByUsername,
  inviteUrl,
  listPendingInvitees,
  listSpaceInvites,
  revokeSpaceInvite,
} from './api';

const EXPIRY_OPTIONS = [
  { value: '24', label: '1 day' },
  { value: '168', label: '7 days' },
  { value: '720', label: '30 days' },
  { value: 'never', label: 'Never' },
] as const;

const USES_OPTIONS = [
  { value: 'unlimited', label: 'No limit' },
  { value: '1', label: '1 person' },
  { value: '5', label: '5 people' },
  { value: '10', label: '10 people' },
  { value: '25', label: '25 people' },
  { value: '50', label: '50 people' },
] as const;

function formatInstant(iso: string): string {
  const ms = Date.parse(iso);
  const zone = browserTimeZone();
  return `${formatDateKey(epochToZoned(ms, zone).date)}, ${formatTimeIn(ms, zone)}`;
}

export default function InvitePanel({
  space,
  canManageInvites,
  viewerId,
}: {
  space: Space;
  canManageInvites: boolean;
  viewerId: string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const links = useAsyncData(() => listSpaceInvites(space.id), [space.id], 'Could not load invite links.');
  const pending = useAsyncData(() => listPendingInvitees(space.id), [space.id], 'Could not load invitations.');

  const [username, setUsername] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<string>('168');
  const [uses, setUses] = useState<string>('unlimited');
  const [linkError, setLinkError] = useState<string | null>(null);
  const action = useBusyAction();

  function sendInvite(event: FormEvent) {
    event.preventDefault();
    const name = username.trim().replace(/^@/, '');
    if (name.length === 0) return;
    void action.run(async () => {
      setInviteError(null);
      try {
        await inviteByUsername(space.id, name);
        toast(`Invitation sent to @${name}.`);
        setUsername('');
        await pending.reload();
      } catch (caught) {
        setInviteError(messageOf(caught, 'Could not send that invitation.'));
      }
    });
  }

  function makeLink() {
    void action.run(async () => {
      setLinkError(null);
      try {
        const invite = await createSpaceInvite(space.id, {
          expiresInHours: expiry === 'never' ? null : Number(expiry),
          maxUses: uses === 'unlimited' ? null : Number(uses),
        });
        links.setData((current) => [invite, ...(current ?? [])]);
        // Not shared automatically: the share sheet and the clipboard both
        // need a fresh tap, and Safari refuses them once a network round trip
        // has passed since the click. The new link is first in the list,
        // with its own Share button.
        toast('Link created. Tap Share to send it.');
      } catch (caught) {
        setLinkError(messageOf(caught, 'Could not create an invite link.'));
      }
    });
  }

  async function share(invite: SpaceInvite) {
    try {
      const result = await shareOrCopy({
        title: space.name,
        text: `Join "${space.name}" on Schedule Matcher.`,
        url: inviteUrl(invite.code),
      });
      if (result === 'copied') toast('Link copied.');
    } catch {
      toast('Could not copy automatically. Press and hold the link to copy it.', 'error');
    }
  }

  async function turnOff(invite: SpaceInvite) {
    const ok = await confirm({
      title: 'Turn off this link?',
      body: 'Anyone who has it will no longer be able to join. People who already joined stay in.',
      confirmLabel: 'Turn off',
      destructive: true,
    });
    if (!ok) return;
    void action.run(async () => {
      try {
        await revokeSpaceInvite(invite.id);
        toast('Link turned off.', 'info');
        await links.reload();
      } catch (caught) {
        toast(messageOf(caught, 'Could not turn off that link.'), 'error');
      }
    });
  }

  async function cancelInvitation(id: string, name: string) {
    const ok = await confirm({ title: `Withdraw the invitation to @${name}?`, confirmLabel: 'Withdraw' });
    if (!ok) return;
    void action.run(async () => {
      try {
        await deleteInvitation(id);
        await pending.reload();
      } catch (caught) {
        toast(messageOf(caught, 'Could not withdraw that invitation.'), 'error');
      }
    });
  }

  const now = Date.now();
  const activeLinks = (links.data ?? []).filter((invite) => inviteLinkState(invite, now) === 'active');
  const inactiveCount = (links.data ?? []).length - activeLinks.length;
  const pendingList = pending.data ?? [];

  return (
    <Section title="Invite people">
      <Card className="flex flex-col gap-5">
        <form onSubmit={sendInvite} className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextField
                label="Invite by username"
                placeholder="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setInviteError(null);
                }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={action.busy || username.trim().length === 0}>
              Invite
            </Button>
          </div>
          {inviteError && <Notice tone="error">{inviteError}</Notice>}
          <p className="text-xs text-slate-500">They get a notification and choose whether to join.</p>
        </form>

        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-700">Or share a link</p>
          <div className="grid grid-cols-2 gap-2">
            <SelectField label="Expires after" value={expiry} onChange={(e) => setExpiry(e.target.value)} options={EXPIRY_OPTIONS} />
            <SelectField label="Can be used by" value={uses} onChange={(e) => setUses(e.target.value)} options={USES_OPTIONS} />
          </div>
          <Button onClick={makeLink} disabled={action.busy}>
            Create link
          </Button>
          {linkError && <Notice tone="error">{linkError}</Notice>}
        </div>

        {links.error && <Notice tone="warning">{links.error}</Notice>}

        {activeLinks.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-slate-700">
              {canManageInvites ? 'Active links' : 'Your active links'}
            </p>
            <ul className="flex flex-col gap-2">
              {activeLinks.map((invite) => (
                <li key={invite.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="break-all font-mono text-xs text-slate-600">{inviteUrl(invite.code)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {invite.expiresAt ? `Expires ${formatInstant(invite.expiresAt)}` : 'Never expires'}
                    {' · '}
                    {invite.maxUses === null
                      ? `${invite.useCount} joined`
                      : `${invite.useCount} of ${invite.maxUses} used`}
                    {invite.createdBy === viewerId ? ' · made by you' : ''}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void share(invite)}>
                      {typeof navigator !== 'undefined' && 'share' in navigator ? 'Share' : 'Copy'}
                    </Button>
                    {(canManageInvites || invite.createdBy === viewerId) && (
                      <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => void turnOff(invite)}>
                        Turn off
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {inactiveCount > 0 && (
              <p className="text-xs text-slate-500">
                {inactiveCount} older {inactiveCount === 1 ? 'link has' : 'links have'} expired, been used up or
                been turned off.
              </p>
            )}
          </div>
        )}

        {pendingList.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-slate-700">Waiting for an answer</p>
            <ul className="flex flex-col gap-2">
              {pendingList.map((invitation) => (
                <li key={invitation.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 pl-3">
                  <Avatar username={invitation.invitee.username} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">@{invitation.invitee.username}</span>
                  <Badge tone="amber">Invited</Badge>
                  {(canManageInvites || invitation.invitedBy === viewerId) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void cancelInvitation(invitation.id, invitation.invitee.username)}
                    >
                      Withdraw
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </Section>
  );
}
