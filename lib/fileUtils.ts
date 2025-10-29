export async function extractTextFromFile(file: File): Promise<string> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
  switch (fileExtension) {
    case 'txt':
      return await file.text();
    
    case 'pdf':
      // For PDF files, we'll send to server for extraction since pdf-parse doesn't work in browser
      return await extractTextViaAPI(file);
    
    case 'docx':
    case 'doc':
      // For Word files, we'll send to server for extraction
      return await extractTextViaAPI(file);
    
    default:
      // Try to read as text
      try {
        return await file.text();
      } catch (error) {
        throw new Error(`Unsupported file type: ${fileExtension}`);
      }
  }
}

async function extractTextViaAPI(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/extract-text', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to extract text from file');
  }

  const result = await response.json();
  return result.text || '';
}