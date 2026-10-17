// src/features/spaces/CreateSpacePage.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { messageOf } from '@/lib/supabaseErrors';
import { useBusyAction } from '@/lib/useBusyAction';
import {
  SPACE_DESCRIPTION_MAX,
  SPACE_NAME_MAX,
  validateSpaceDraft,
  type SpaceDraftErrors,
  type SpaceKind,
} from '@/domain/spaces';
import { browserTimeZone } from '@/domain/zonedTime';
import BackButton from '@/components/BackButton';
import Button from '@/components/Button';
import { TextAreaField, TextField } from '@/components/Field';
import { Notice, PageHeader } from '@/components/Layout';
import TimeZoneSelect from '@/components/TimeZoneSelect';
import { useToast } from '@/components/Toast';
import SpaceKindPicker from './SpaceKindPicker';
import { createSpace } from './api';

export default function CreateSpacePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SpaceKind>('class');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState(() => browserTimeZone());
  const [errors, setErrors] = useState<SpaceDraftErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const { busy: saving, run } = useBusyAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateSpaceDraft({ name, description, timezone });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    void run(async () => {
      setServerError(null);
      try {
        const spaceId = await createSpace({ name: name.trim(), kind, description, timezone });
        toast('Space created. Invite your group next.');
        navigate(`/spaces/${spaceId}/members`, { replace: true });
      } catch (caught) {
        setServerError(messageOf(caught, 'Could not create the space.'));
      }
    });
  }

  return (
    <main className="flex flex-col gap-5 px-4 pb-6 pt-4">
      <div>
        <BackButton to="/spaces" />
      </div>
      <PageHeader title="New space" subtitle="You can change any of this later in the space's settings." />

      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <TextField
          label="Name"
          placeholder="Psychology — Group 04"
          value={name}
          maxLength={SPACE_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          disabled={saving}
          autoFocus
        />

        <SpaceKindPicker value={kind} onChange={setKind} disabled={saving} />

        <TextAreaField
          label="Description (optional)"
          placeholder="What the group is for, where you usually meet…"
          value={description}
          maxLength={SPACE_DESCRIPTION_MAX}
          onChange={(event) => setDescription(event.target.value)}
          error={errors.description}
          disabled={saving}
        />

        <TimeZoneSelect
          value={timezone}
          onChange={setTimezone}
          hint="Meeting times in this space are shown and searched in this zone."
          error={errors.timezone}
          disabled={saving}
        />

        {serverError && <Notice tone="error">{serverError}</Notice>}

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Creating…' : 'Create space'}
        </Button>
      </form>
    </main>
  );
}
