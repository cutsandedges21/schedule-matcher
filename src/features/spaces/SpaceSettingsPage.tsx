// src/features/spaces/SpaceSettingsPage.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { messageOf } from '@/lib/supabaseErrors';
import { useBusyAction } from '@/lib/useBusyAction';
import {
  canInSpace,
  SHARE_LEVELS,
  SPACE_DESCRIPTION_MAX,
  SPACE_NAME_MAX,
  validateSpaceDraft,
  type ShareLevel,
  type SpaceDraftErrors,
  type SpaceKind,
} from '@/domain/spaces';
import Button from '@/components/Button';
import { CheckboxField, TextAreaField, TextField } from '@/components/Field';
import { Card, Notice, Section } from '@/components/Layout';
import TimeZoneSelect from '@/components/TimeZoneSelect';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import SpaceKindPicker from './SpaceKindPicker';
import { useSpace } from './SpaceLayout';
import { deleteSpace, leaveSpace, updateMyMembership, updateSpace } from './api';

export default function SpaceSettingsPage() {
  const { space, members, me, reload } = useSpace();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { busy, run } = useBusyAction();

  const ctx = { role: me.role, membersCanInvite: space.membersCanInvite };
  const canEdit = canInSpace(ctx, 'edit_settings');
  const isOwner = me.role === 'owner';
  const alone = members.length === 1;

  const [name, setName] = useState(space.name);
  const [kind, setKind] = useState<SpaceKind>(space.kind);
  const [description, setDescription] = useState(space.description ?? '');
  const [timezone, setTimezone] = useState(space.timezone);
  const [membersCanInvite, setMembersCanInvite] = useState(space.membersCanInvite);
  const [errors, setErrors] = useState<SpaceDraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty =
    name !== space.name ||
    kind !== space.kind ||
    description !== (space.description ?? '') ||
    timezone !== space.timezone ||
    membersCanInvite !== space.membersCanInvite;

  function save(event: FormEvent) {
    event.preventDefault();
    const found = validateSpaceDraft({ name, description, timezone });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    void run(async () => {
      setSaveError(null);
      try {
        await updateSpace(space.id, { name: name.trim(), kind, description, timezone, membersCanInvite });
        await reload();
        toast('Settings saved.');
      } catch (caught) {
        setSaveError(messageOf(caught, 'Could not save the settings.'));
      }
    });
  }

  function chooseShareLevel(level: ShareLevel) {
    if (level === me.shareLevel) return;
    void run(async () => {
      try {
        await updateMyMembership(space.id, me.userId, { shareLevel: level });
        await reload();
        toast('Sharing updated.');
      } catch (caught) {
        toast(messageOf(caught, 'Could not change your sharing.'), 'error');
      }
    });
  }

  function togglePinned() {
    void run(async () => {
      try {
        await updateMyMembership(space.id, me.userId, { pinned: !me.pinned });
        await reload();
      } catch (caught) {
        toast(messageOf(caught, 'Could not update that.'), 'error');
      }
    });
  }

  async function leave() {
    const ok = await confirm({
      title: alone ? `Leave and delete ${space.name}?` : `Leave ${space.name}?`,
      body: alone
        ? 'You are the only member, so the space and everything in it will be deleted.'
        : 'You lose access to its calendar, tasks and polls. You can rejoin only with a new invitation.',
      confirmLabel: alone ? 'Leave and delete' : 'Leave',
      destructive: true,
    });
    if (!ok) return;
    void run(async () => {
      try {
        await leaveSpace(space.id);
        toast(alone ? 'Space deleted.' : `You left ${space.name}.`, 'info');
        navigate('/spaces', { replace: true });
      } catch (caught) {
        toast(messageOf(caught, 'Could not leave the space.'), 'error');
      }
    });
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete ${space.name}?`,
      body: `Its events, tasks, polls and resources are deleted for all ${members.length} members. This cannot be undone.`,
      confirmLabel: 'Delete forever',
      destructive: true,
      requireText: space.name,
    });
    if (!ok) return;
    void run(async () => {
      try {
        await deleteSpace(space.id);
        toast('Space deleted.', 'info');
        navigate('/spaces', { replace: true });
      } catch (caught) {
        toast(messageOf(caught, 'Could not delete the space.'), 'error');
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Section title="Your availability in this space">
        <Card>
          <fieldset className="flex flex-col gap-2" disabled={busy}>
            <legend className="sr-only">What members of this space can see</legend>
            {SHARE_LEVELS.map((level) => (
              <label
                key={level.id}
                className={`flex min-h-touch cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                  me.shareLevel === level.id ? 'border-accent bg-accent-soft' : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="share-level"
                  className="mt-1 h-4 w-4 accent-slate-900"
                  checked={me.shareLevel === level.id}
                  onChange={() => chooseShareLevel(level.id)}
                />
                <span>
                  <span className="block text-sm font-semibold">{level.label}</span>
                  <span className="block text-xs text-slate-600">{level.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="mt-3 text-xs text-slate-500">
            This only affects {space.name}. Other spaces never see your schedule details — at most that
            you are busy.
          </p>
          <CheckboxField
            className="mt-2 border-t border-slate-200 pt-3"
            label="Pin to the top of my spaces"
            checked={me.pinned}
            onChange={togglePinned}
            disabled={busy}
          />
        </Card>
      </Section>

      {canEdit ? (
        <Section title="Space settings">
          <Card>
            <form onSubmit={save} className="flex flex-col gap-4" noValidate>
              <TextField
                label="Name"
                value={name}
                maxLength={SPACE_NAME_MAX}
                onChange={(event) => setName(event.target.value)}
                error={errors.name}
              />
              <SpaceKindPicker value={kind} onChange={setKind} />
              <TextAreaField
                label="Description"
                value={description}
                maxLength={SPACE_DESCRIPTION_MAX}
                onChange={(event) => setDescription(event.target.value)}
                error={errors.description}
              />
              <TimeZoneSelect
                value={timezone}
                onChange={setTimezone}
                hint="Meeting times in this space are shown and searched in this zone."
                error={errors.timezone}
              />
              <CheckboxField
                label="Let members invite people"
                description="Otherwise only the owner and admins can send invitations and links."
                checked={membersCanInvite}
                onChange={(event) => setMembersCanInvite(event.target.checked)}
              />
              {saveError && <Notice tone="error">{saveError}</Notice>}
              <Button type="submit" disabled={busy || !dirty}>
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </Card>
        </Section>
      ) : (
        <Notice>Only the owner and admins can change this space&rsquo;s name and settings.</Notice>
      )}

      <Section title="Leave or delete">
        <Card className="flex flex-col gap-3">
          {isOwner && !alone ? (
            <p className="text-sm text-slate-600">
              You own this space. To leave, first make another member the owner from the Members tab.
            </p>
          ) : (
            <Button variant="secondary" className="border-rose-300 text-rose-700" disabled={busy} onClick={() => void leave()}>
              Leave space
            </Button>
          )}
          {isOwner && (
            <Button
              className="bg-rose-600 text-white active:bg-rose-700"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete space
            </Button>
          )}
        </Card>
      </Section>
    </div>
  );
}
