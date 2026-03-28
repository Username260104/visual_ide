import { NextRequest, NextResponse } from 'next/server';
import { deleteImages, uploadImageAssetFromFile } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const upload = await uploadImageAssetFromFile(projectId, file);

    return NextResponse.json({
      imageUrl: upload.publicUrl,
      imagePath: upload.path,
      width: upload.width,
      height: upload.height,
      aspectRatio: upload.aspectRatio,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const imagePath =
      body && typeof body === 'object' && !Array.isArray(body)
        ? Reflect.get(body, 'imagePath')
        : null;

    if (typeof imagePath !== 'string' || !imagePath.trim()) {
      return NextResponse.json(
        { error: 'imagePath is required' },
        { status: 400 }
      );
    }

    await deleteImages([imagePath.trim()]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Image delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
