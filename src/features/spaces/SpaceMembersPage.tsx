// src/features/spaces/SpaceMembersPage.tsx
import { messageOf } from '@/lib/supabaseErrors';
import { useBusyAction } from '@/lib/useBusyAction';
import {
  canInSpace,
  canRemoveMember,
  compareMembers,
  ROLE_LABELS,
  SHARE_LEVELS,
  type SpaceRole,
} from '@/domain/spaces';
import type { SpaceMember } from '@/domain/spaceMappers';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import { Badge, Section } from '@/components/Layout';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { useSpace } from './SpaceLayout';
import InvitePanel from './InvitePanel';
import { removeMember, setMemberRole, transferOwnership } from './api';

const ROLE_TONES: Record<SpaceRole, 'violet' | 'sky' | 'slate'> = {
  owner: 'violet',
  admin: 'sky',
  member: 'slate',
};

export default function SpaceMembersPage() {
  const { space, members, me, reload } = useSpace();
  const confirm = useConfirm();
  const toast = useToast();
  const { busy, run } = useBusyAction();

  const ctx = { role: me.role, membersCanInvite: space.membersCanInvite };
  const sorted = [...members].sort(compareMembers);

  async function act(
    member: SpaceMember,
    kind: 'promote' | 'demote' | 'transfer' | 'remove'
  ) {
    const name = `@${member.profile.username}`;
    const prompts = {
      promote: {
        title: `Make ${name} an admin?`,
        body: 'Admins can invite and remove members and edit or close anything in the space.',
        confirmLabel: 'Make admin',
        destructive: false,
      },
      demote: {
        title: `Remove ${name}'s admin role?`,
        body: 'They stay in the space as a regular member.',
        confirmLabel: 'Make member',
        destructive: false,
      },
      transfer: {
        title: `Make ${name} the owner?`,
        body: 'You become an admin. Only the owner can delete the space, change roles or hand ownership on.',
        confirmLabel: 'Transfer ownership',
        destructive: true,
      },
      remove: {
        title: `Remove ${name} from ${space.name}?`,
        body: 'They lose access to everything in this space. They can come back only with a new invitation.',
        confirmLabel: 'Remove',
        destructive: true,
      },
    } as const;

    if (!(await confirm(prompts[kind]))) return;

    void run(async () => {
      try {
        if (kind === 'promote') await setMemberRole(space.id, member.userId, 'admin');
        if (kind === 'demote') await setMemberRole(space.id, member.userId, 'member');
        if (kind === 'transfer') await transferOwnership(space.id, member.userId);
        if (kind === 'remove') await removeMember(space.id, member.userId);
        await reload();
        toast(
          kind === 'remove'
            ? `${name} was removed.`
            : kind === 'transfer'
              ? `${name} now owns the space.`
              : `${name} is now ${kind === 'promote' ? 'an admin' : 'a member'}.`
        );
      } catch (caught) {
        toast(messageOf(caught, 'That change did not go through.'), 'error');
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {canInSpace(ctx, 'invite') && (
        <InvitePanel space={space} canManageInvites={canInSpace(ctx, 'manage_invites')} viewerId={me.userId} />
      )}

      <Section title={`Members (${members.length})`}>
        <ul className="flex flex-col gap-2">
          {sorted.map((member) => {
            const isMe = member.userId === me.userId;
            const share = SHARE_LEVELS.find((level) => level.id === member.shareLevel);
            const canRemove = canRemoveMember({ id: me.userId, role: me.role }, { id: member.userId, role: member.role });
            const canChangeRole = canInSpace(ctx, 'change_roles') && !isMe;

            return (
              <li key={member.userId} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-3">
                  <Avatar username={member.profile.username} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      @{member.profile.username}
                      {isMe && <span className="font-normal text-slate-500"> (you)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {member.profile.displayName ? `${member.profile.displayName} · ` : ''}
                      Shares {share?.label.toLowerCase() ?? 'free/busy only'}
                    </p>
                  </div>
                  <Badge tone={ROLE_TONES[member.role]}>{ROLE_LABELS[member.role]}</Badge>
                </div>

                {(canChangeRole || canRemove) && member.role !== 'owner' && (
                  <div className="mt-2 flex flex-wrap gap-2 pl-12">
                    {canChangeRole && member.role === 'member' && (
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(member, 'promote')}>
                        Make admin
                      </Button>
                    )}
                    {canChangeRole && member.role === 'admin' && (
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(member, 'demote')}>
                        Make member
                      </Button>
                    )}
                    {canInSpace(ctx, 'transfer_ownership') && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(member, 'transfer')}>
                        Make owner
                      </Button>
                    )}
                    {canRemove && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-700"
                        disabled={busy}
                        onClick={() => void act(member, 'remove')}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
