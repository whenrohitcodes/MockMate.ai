import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Text extraction API called');
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('File details:', {
      name: file?.name,
      type: file?.type,
      size: file?.size
    });

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('Starting text extraction...');
    const extractedText = await extractTextFromFile(file);
    console.log('Text extraction successful, length:', extractedText.length);

    return NextResponse.json({
      success: true,
      text: extractedText,
      fileName: file.name,
      fileSize: file.size,
    });

  } catch (error) {
    console.error('Text extraction error:', error);
    return NextResponse.json(
      { error: 'Text extraction failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  console.log(`Extracting text from ${fileExtension} file, size: ${buffer.byteLength} bytes`);

  try {
    switch (fileExtension) {
      case 'pdf':
        console.log('Processing PDF file...');
        try {
          // Use dynamic import for pdf-parse to handle ES module issues
          const pdfParse = require('pdf-parse');
          console.log('pdf-parse loaded successfully');
          const pdfData = await pdfParse(Buffer.from(buffer));
          console.log('PDF parsing successful, text length:', pdfData.text.length);
          return pdfData.text;
        } catch (pdfError) {
          console.error('PDF parsing failed:', pdfError);
          throw new Error(`PDF parsing failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown PDF error'}`);
        }
      
      case 'docx':
        console.log('Processing DOCX file...');
        try {
          const mammoth = await import('mammoth');
          const docxResult = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
          console.log('DOCX parsing successful, text length:', docxResult.value.length);
          return docxResult.value;
        } catch (docxError) {
          console.error('DOCX parsing failed:', docxError);
          throw new Error(`DOCX parsing failed: ${docxError instanceof Error ? docxError.message : 'Unknown DOCX error'}`);
        }
      
      case 'doc':
        console.log('Processing DOC file...');
        try {
          const mammothDoc = await import('mammoth');
          const docResult = await mammothDoc.extractRawText({ buffer: Buffer.from(buffer) });
          console.log('DOC parsing successful, text length:', docResult.value.length);
          return docResult.value;
        } catch (docError) {
          console.error('DOC parsing failed:', docError);
          throw new Error(`DOC parsing failed: ${docError instanceof Error ? docError.message : 'Unknown DOC error'}`);
        }
      
      case 'txt':
        console.log('Processing TXT file...');
        const textContent = new TextDecoder().decode(buffer);
        console.log('TXT parsing successful, text length:', textContent.length);
        return textContent;
      
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  } catch (error) {
    console.error(`Error extracting text from ${fileExtension} file:`, error);
    throw error; // Re-throw the original error with more context
  }
}