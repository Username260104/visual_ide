import { supabaseAdmin } from './supabase';
import { nanoid } from 'nanoid';

const BUCKET = 'images';

/**
 * Upload a buffer to Supabase Storage and return the public URL.
 */
export async function uploadImage(
  projectId: string,
  buffer: Buffer,
  ext: string = '.webp'
): Promise<string> {
  const filename = `${nanoid()}${ext}`;
  const path = `${projectId}/${filename}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: ext === '.webp' ? 'image/webp' : 'image/png',
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Upload from a File object (form data).
 */
export async function uploadImageFromFile(
  projectId: string,
  file: File
): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '.png';
  return uploadImage(projectId, buffer, ext);
}

/**
 * Upload from a URL (Replicate output).
 */
export async function uploadImageFromUrl(
  projectId: string,
  url: string
): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return uploadImage(projectId, buffer, '.webp');
}

/**
 * Upload from a ReadableStream (Replicate output).
 */
export async function uploadImageFromStream(
  projectId: string,
  stream: ReadableStream
): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) chunks.push(result.value);
  }
  const buffer = Buffer.concat(chunks);
  return uploadImage(projectId, buffer, '.webp');
}
