import { NextRequest, NextResponse } from 'next/server';
import ImageKit from 'imagekit';

let imagekit: ImageKit;

try {
  imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_URL_PUBLIC_KEY!,
    privateKey: process.env.IMAGEKIT_URL_PRIVATE_KEY!,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
  });
  console.log('ImageKit initialized successfully');
} catch (error) {
  console.error('Failed to initialize ImageKit:', error);
}

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API called');
    console.log('Environment variables check:', {
      hasPublicKey: !!process.env.IMAGEKIT_URL_PUBLIC_KEY,
      hasPrivateKey: !!process.env.IMAGEKIT_URL_PRIVATE_KEY,
      hasEndpoint: !!process.env.IMAGEKIT_URL_ENDPOINT,
      endpoint: process.env.IMAGEKIT_URL_ENDPOINT
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;
    const folder = formData.get('folder') as string;

    console.log('Upload request details:', {
      hasFile: !!file,
      fileName: fileName,
      folder: folder,
      fileSize: file?.size,
      fileType: file?.type
    });

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!imagekit) {
      console.error('ImageKit not initialized');
      return NextResponse.json({ error: 'ImageKit not configured' }, { status: 500 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log('Attempting ImageKit upload...');

    // Upload to ImageKit
    const result = await imagekit.upload({
      file: buffer,
      fileName: fileName || file.name,
      folder: folder || '/uploads',
      useUniqueFileName: true,
    });

    console.log('ImageKit upload successful:', {
      url: result.url,
      fileId: result.fileId
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      fileId: result.fileId,
      filePath: result.filePath,
    });

  } catch (error) {
    console.error('ImageKit upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error },
      { status: 500 }
    );
  }
}