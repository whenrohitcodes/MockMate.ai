import { NextRequest, NextResponse } from 'next/server';
import ImageKit from 'imagekit';
import path from 'path';
import dotenv from 'dotenv';

// Explicitly load env for local dev (Windows/OneDrive sometimes misses .env.local)
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Force Node runtime so Buffer/ImageKit work correctly
export const runtime = 'nodejs';

let imagekit: ImageKit | undefined;

function ensureImageKit(): ImageKit | undefined {
  if (imagekit) return imagekit;

  const publicKey = process.env.IMAGEKIT_URL_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_URL_PRIVATE_KEY;
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  const hasPublicKey = !!publicKey;
  const hasPrivateKey = !!privateKey;
  const hasEndpoint = !!endpoint;

  // Log masked lengths so we can debug env loading without leaking secrets
  console.log('ImageKit env check:', {
    hasPublicKey,
    hasPrivateKey,
    hasEndpoint,
    publicKeyLen: publicKey?.length || 0,
    privateKeyLen: privateKey?.length || 0,
    endpointLen: endpoint?.length || 0,
  });

  if (!hasPublicKey || !hasPrivateKey || !hasEndpoint) {
    console.error('ImageKit keys missing');
    return undefined;
  }

  try {
    imagekit = new ImageKit({
      publicKey,
      privateKey,
      urlEndpoint: endpoint,
    });
    console.log('ImageKit initialized successfully');
    return imagekit;
  } catch (error) {
    console.error('Failed to initialize ImageKit:', error);
    return undefined;
  }
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

    const ik = ensureImageKit();
    if (!ik) {
      console.error('ImageKit not initialized');
      return NextResponse.json({
        error: 'ImageKit not configured. Check env keys and restart dev server.',
        debug: {
          hasPublicKey: !!process.env.IMAGEKIT_URL_PUBLIC_KEY,
          hasPrivateKey: !!process.env.IMAGEKIT_URL_PRIVATE_KEY,
          hasEndpoint: !!process.env.IMAGEKIT_URL_ENDPOINT,
        }
      }, { status: 500 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log('Attempting ImageKit upload...');

    // Upload to ImageKit
    const result = await ik.upload({
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('ImageKit upload error:', message, error);
    return NextResponse.json(
      { error: 'Upload failed', details: message },
      { status: 500 }
    );
  }
}