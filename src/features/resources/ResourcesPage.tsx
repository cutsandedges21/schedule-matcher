// src/features/resources/ResourcesPage.tsx
import { useState, type FormEvent } from 'react';
import { useAsyncData } from '@/lib/useAsyncData';
import { useBusyAction } from '@/lib/useBusyAction';
import { messageOf } from '@/lib/supabaseErrors';
import { isWebUrl } from '@/domain/events';
import { relativeTime } from '@/domain/relativeTime';
import type { ResourceCategory, SpaceResource } from '@/domain/planMappers';
import Button from '@/components/Button';
import Icon from '@/components/Icon';
import { SelectField, TextAreaField, TextField } from '@/components/Field';
import { Card, InlineEmpty, Notice, Section } from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { useSpace } from '@/features/spaces/SpaceLayout';
import { addResource, deleteResource, listResources, updateResource, type ResourceInput } from './api';

const CATEGORIES: { value: ResourceCategory; label: string }[] = [
  { value: 'course', label: 'Course material' },
  { value: 'document', label: 'Shared document' },
  { value: 'study', label: 'Study resource' },
  { value: 'project', label: 'Project link' },
  { value: 'reference', label: 'Reference' },
  { value: 'link', label: 'Other link' },
];

const EMPTY: ResourceInput = { title: '', url: '', category: 'course', description: '' };

function validate(input: ResourceInput): Partial<Record<keyof ResourceInput, string>> {
  const errors: Partial<Record<keyof ResourceInput, string>> = {};
  if (!input.title.trim()) errors.title = 'Give it a name.';
  else if (input.title.trim().length > 120) errors.title = 'At most 120 characters.';
  if (!isWebUrl(input.url)) errors.url = 'Paste a full link starting with https://';
  if (input.description.length > 500) errors.description = 'At most 500 characters.';
  return errors;
}

/** Links only: no uploads — a Drive or OneDrive link covers files without this app holding them. */
export default function ResourcesPage() {
  const { space, members, me } = useSpace();
  const toast = useToast();
  const confirm = useConfirm();
  const { busy, run } = useBusyAction();
  const list = useAsyncData(() => listResources(space.id), [space.id], 'Could not load the saved links.');
  const [form, setForm] = useState<ResourceInput | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ResourceInput, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const manager = me.role === 'owner' || me.role === 'admin';
  const labelOf = (id: string | null) =>
    !id ? 'someone' : id === me.userId ? 'you' : `@${members.find((m) => m.userId === id)?.profile.username ?? 'a former member'}`;

  function open(resource?: SpaceResource) {
    setErrors({});
    setServerError(null);
    setEditing(resource?.id ?? null);
    setForm(resource ? { title: resource.title, url: resource.url, category: resource.category, description: resource.description ?? '' } : { ...EMPTY });
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void run(async () => {
      setServerError(null);
      try {
        if (editing) await updateResource(editing, form);
        else await addResource(space.id, me.userId, form);
        setForm(null);
        setEditing(null);
        await list.reload();
        toast(editing ? 'Link updated.' : 'Link saved for the group.');
      } catch (caught) {
        setServerError(messageOf(caught, 'Could not save that link.'));
      }
    });
  }

  async function remove(resource: SpaceResource) {
    if (!(await confirm({ title: `Remove “${resource.title}”?`, confirmLabel: 'Remove', destructive: true }))) return;
    void run(async () => {
      try {
        await deleteResource(resource.id);
        await list.reload();
      } catch (caught) {
        toast(messageOf(caught, 'Could not remove that link.'), 'error');
      }
    });
  }

  if (list.loading && !list.data) return <Spinner inline label="Loading links" />;
  const items = list.data ?? [];
  const now = Date.now();

  return (
    <div className="flex flex-col gap-5">
      {form ? (
        <Card className="border-accent">
          <form onSubmit={save} className="flex flex-col gap-3" noValidate>
            <p className="text-sm font-semibold">{editing ? 'Edit link' : 'Save a link for the group'}</p>
            <TextField label="Name" placeholder="Week 6 lecture slides" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} autoFocus />
            <TextField label="Link" type="url" inputMode="url" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} error={errors.url} />
            <SelectField label="Kind" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ResourceCategory })} options={CATEGORIES} />
            <TextAreaField label="Note (optional)" maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={errors.description} />
            {serverError && <Notice tone="error">{serverError}</Notice>}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Button onClick={() => open()} className="gap-1">
          <Icon name="plus" className="h-4 w-4" /> Save a link
        </Button>
      )}

      {list.error && <Notice tone="warning">{list.error}</Notice>}

      {items.length === 0 ? (
        <InlineEmpty>Course pages, shared docs and study guides the group keeps coming back to belong here.</InlineEmpty>
      ) : (
        CATEGORIES.filter((c) => items.some((r) => r.category === c.value)).map((category) => (
          <Section key={category.value} title={category.label}>
            <ul className="flex flex-col gap-2">
              {items
                .filter((r) => r.category === category.value)
                .map((resource) => (
                  <li key={resource.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block font-semibold underline-offset-2 hover:underline">{resource.title}</span>
                        <span className="block truncate text-xs text-slate-500">{resource.url.replace(/^https?:\/\//, '')}</span>
                      </span>
                      <span aria-hidden className="text-slate-400">↗</span>
                    </a>
                    {resource.description && <p className="mt-1 text-sm text-slate-700">{resource.description}</p>}
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">
                        Shared by {labelOf(resource.createdBy)} · {relativeTime(Date.parse(resource.createdAt), now)}
                      </p>
                      {(resource.createdBy === me.userId || manager) && (
                        <span className="flex gap-1">
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => open(resource)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="text-rose-700" disabled={busy} onClick={() => void remove(resource)}>
                            Remove
                          </Button>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </Section>
        ))
      )}
    </div>
  );
}
