import { nanoid } from 'nanoid';
import { supabaseAdmin } from './supabase';

const BUCKET = 'images';

export interface StorageUploadResult {
  path: string;
  publicUrl: string;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
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
  const metadata = getImageMetadata(buffer);

  return {
    path,
    publicUrl: data.publicUrl,
    width: metadata?.width ?? null,
    height: metadata?.height ?? null,
    aspectRatio: metadata
      ? getAspectRatioLabel(metadata.width, metadata.height)
      : null,
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

function getImageMetadata(buffer: Buffer) {
  return (
    getPngMetadata(buffer) ??
    getGifMetadata(buffer) ??
    getJpegMetadata(buffer) ??
    getWebpMetadata(buffer)
  );
}

function getPngMetadata(buffer: Buffer) {
  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47
  ) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function getGifMetadata(buffer: Buffer) {
  if (
    buffer.length < 10 ||
    (buffer.toString('ascii', 0, 6) !== 'GIF87a' &&
      buffer.toString('ascii', 0, 6) !== 'GIF89a')
  ) {
    return null;
  }

  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function getJpegMetadata(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    if (segmentLength < 2) {
      break;
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function getWebpMetadata(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }

  const chunkType = buffer.toString('ascii', 12, 16);

  if (chunkType === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkType === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];

    return {
      width: 1 + (b0 | ((b1 & 0x3f) << 8)),
      height: 1 + (((b1 & 0xc0) >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)),
    };
  }

  return null;
}

function getAspectRatioLabel(width: number, height: number) {
  if (!width || !height) {
    return null;
  }

  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }

  return a || 1;
}
