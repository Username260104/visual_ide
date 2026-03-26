import { nanoid } from 'nanoid';
import { supabaseAdmin } from './supabase';

const BUCKET = 'images';

export interface StorageUploadResult {
  path: string;
  publicUrl: string;
}

/**
 * Upload a buffer to Supabase Storage and return the public URL.
 */
export async function uploadImage(
  projectId: string,
  buffer: Buffer,
  ext: string = '.webp'
): Promise<string> {
  const result = await uploadImageAsset(projectId, buffer, ext);
  return result.publicUrl;
}

export async function uploadImageAsset(
  projectId: string,
  buffer: Buffer,
  ext: string = '.webp'
): Promise<StorageUploadResult> {
  const filename = `${nanoid()}${ext}`;
  const path = `${projectId}/${filename}`;

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    contentType: getContentType(ext),
    upsert: false,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
}

/**
 * Upload from a File object (form data).
 */
export async function uploadImageFromFile(
  projectId: string,
  file: File
): Promise<string> {
  const result = await uploadImageAssetFromFile(projectId, file);
  return result.publicUrl;
}

export async function uploadImageAssetFromFile(
  projectId: string,
  file: File
): Promise<StorageUploadResult> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '.png';
  return uploadImageAsset(projectId, buffer, ext);
}

/**
 * Upload from a URL (Replicate output).
 */
export async function uploadImageFromUrl(
  projectId: string,
  url: string
): Promise<string> {
  const result = await uploadImageAssetFromUrl(projectId, url);
  return result.publicUrl;
}

export async function uploadImageAssetFromUrl(
  projectId: string,
  url: string
): Promise<StorageUploadResult> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return uploadImageAsset(projectId, buffer, '.webp');
}

/**
 * Upload from a ReadableStream (Replicate output).
 */
export async function uploadImageFromStream(
  projectId: string,
  stream: ReadableStream
): Promise<string> {
  const result = await uploadImageAssetFromStream(projectId, stream);
  return result.publicUrl;
}

export async function uploadImageAssetFromStream(
  projectId: string,
  stream: ReadableStream
): Promise<StorageUploadResult> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  let done = false;

  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      chunks.push(result.value);
    }
  }

  const buffer = Buffer.concat(chunks);
  return uploadImageAsset(projectId, buffer, '.webp');
}

export async function deleteImages(paths: string[]): Promise<void> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));

  if (uniquePaths.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin.storage.from(BUCKET).remove(uniquePaths);

  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

function getContentType(ext: string) {
  const normalizedExt = ext.toLowerCase();

  switch (normalizedExt) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
    default:
      return 'image/webp';
  }
}