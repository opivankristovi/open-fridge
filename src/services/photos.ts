import { useQuery } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '../lib/supabase';

const BUCKET = 'photos';

/** Resize to 1024px wide and JPEG-compress at 0.7. Returns the new local uri. */
export async function compressPhoto(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1024 });
  const ref = await ctx.renderAsync();
  const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  return result.uri;
}

/** Uploads to `{householdId}/{itemId}.jpg` (the storage RLS path rule) and returns that path. */
export async function uploadItemPhoto(hid: string, itemId: string, localUri: string): Promise<string> {
  const path = `${hid}/${itemId}.jpg`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

export async function deletePhoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export function useSignedPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['photo', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path as string, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: 50 * 60_000,
  });
}
