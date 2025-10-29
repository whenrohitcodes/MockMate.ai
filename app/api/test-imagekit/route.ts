import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'ImageKit Test Endpoint',
    environment: {
      hasPublicKey: !!process.env.IMAGEKIT_URL_PUBLIC_KEY,
      hasPrivateKey: !!process.env.IMAGEKIT_URL_PRIVATE_KEY, 
      hasEndpoint: !!process.env.IMAGEKIT_URL_ENDPOINT,
      endpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      publicKeyLength: process.env.IMAGEKIT_URL_PUBLIC_KEY?.length || 0,
      privateKeyLength: process.env.IMAGEKIT_URL_PRIVATE_KEY?.length || 0
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    // Test ImageKit initialization
    const ImageKit = (await import('imagekit')).default;
    
    const imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_URL_PUBLIC_KEY!,
      privateKey: process.env.IMAGEKIT_URL_PRIVATE_KEY!,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    });

    // Test file upload with a simple text file
    const testContent = 'Hello World Test';
    const buffer = Buffer.from(testContent);

    const result = await imagekit.upload({
      file: buffer,
      fileName: 'test.txt',
      folder: '/test',
      useUniqueFileName: true,
    });

    return NextResponse.json({
      success: true,
      message: 'ImageKit test successful',
      result: {
        url: result.url,
        fileId: result.fileId,
        filePath: result.filePath
      }
    });

  } catch (error) {
    console.error('ImageKit test error:', error);
    return NextResponse.json({
      success: false,
      error: 'ImageKit test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}