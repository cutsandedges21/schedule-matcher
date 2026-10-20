// src/features/resources/api.ts
import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/lib/supabaseErrors';
import {
  RESOURCE_COLUMNS,
  rowToResource,
  type ResourceCategory,
  type ResourceRow,
  type SpaceResource,
} from '@/domain/planMappers';

export async function listResources(spaceId: string): Promise<SpaceResource[]> {
  const { data, error } = await supabase
    .from('space_resources')
    .select(RESOURCE_COLUMNS)
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false });
  throwIfError(error, 'Could not load the saved links.');
  return ((data ?? []) as ResourceRow[]).map(rowToResource);
}

export interface ResourceInput {
  title: string;
  url: string;
  category: ResourceCategory;
  description: string;
}

export async function addResource(spaceId: string, userId: string, input: ResourceInput): Promise<void> {
  const { error } = await supabase.from('space_resources').insert({
    space_id: spaceId,
    created_by: userId,
    title: input.title.trim(),
    url: input.url.trim(),
    category: input.category,
    description: input.description.trim() || null,
  });
  throwIfError(error, 'Could not save that link.');
}

export async function updateResource(resourceId: string, input: ResourceInput): Promise<void> {
  const { data, error } = await supabase
    .from('space_resources')
    .update({
      title: input.title.trim(),
      url: input.url.trim(),
      category: input.category,
      description: input.description.trim() || null,
    })
    .eq('id', resourceId)
    .select('id');
  throwIfError(error, 'Could not save that link.');
  if (!data || data.length === 0) throw new Error('Only whoever shared it, or an admin, can change this link.');
}

export async function deleteResource(resourceId: string): Promise<void> {
  const { data, error } = await supabase.from('space_resources').delete().eq('id', resourceId).select('id');
  throwIfError(error, 'Could not remove that link.');
  if (!data || data.length === 0) throw new Error('Only whoever shared it, or an admin, can remove this link.');
}
