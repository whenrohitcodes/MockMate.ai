import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Force Node runtime so require/pdf-parse works
export const runtime = 'nodejs';

// Create fresh OpenAI client for each request to avoid caching issues
function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error('OPENROUTER_API_KEY missing');
    return null;
  }
  try {
    return new OpenAI({
      apiKey: key,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'MockMate AI Interview',
      },
    });
  } catch (err) {
    console.error('Failed to init OpenAI client:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    let resumeText = '';
    let jobDescriptionText = '';
    let resumeFile: File | null = null;
    let jobDescriptionFile: File | null = null;
    let resumeFileUrl = '';
    let jobDescriptionFileUrl = '';

    if (contentType?.includes('multipart/form-data')) {
      // Handle form data (with files or file URLs)
      const formData = await request.formData();
      resumeFile = formData.get('resumeFile') as File;
      jobDescriptionFile = formData.get('jobDescriptionFile') as File;
      resumeText = formData.get('resumeText') as string || '';
      jobDescriptionText = formData.get('jobDescriptionText') as string || '';
      resumeFileUrl = formData.get('resumeFileUrl') as string || '';
      jobDescriptionFileUrl = formData.get('jobDescriptionFileUrl') as string || '';
    } else {
      // Handle JSON data (text only)
      const body = await request.json();
      resumeText = body.resumeText || '';
      jobDescriptionText = body.jobDescriptionText || '';
      resumeFileUrl = body.resumeFileUrl || '';
      jobDescriptionFileUrl = body.jobDescriptionFileUrl || '';
    }

    let extractedResumeText = resumeText || '';
    let extractedJobDescriptionText = jobDescriptionText || '';

    // Extract text from resume file if provided
    if (resumeFile && resumeFile.size > 0) {
      try {
        extractedResumeText = await extractTextFromFile(resumeFile);
      } catch (error) {
        console.error('Resume file extraction failed:', error);
        // Continue with provided text if any
      }
    }
    // Extract text from resume file URL if provided
    else if (resumeFileUrl && !extractedResumeText) {
      try {
        extractedResumeText = await extractTextFromFileUrl(resumeFileUrl);
      } catch (error) {
        console.error('Resume file URL extraction failed:', error);
      }
    }

    // Extract text from job description file if provided
    if (jobDescriptionFile && jobDescriptionFile.size > 0) {
      try {
        extractedJobDescriptionText = await extractTextFromFile(jobDescriptionFile);
      } catch (error) {
        console.error('Job description file extraction failed:', error);
        // Continue with provided text if any
      }
    }
    // Extract text from job description file URL if provided
    else if (jobDescriptionFileUrl && !extractedJobDescriptionText) {
      try {
        extractedJobDescriptionText = await extractTextFromFileUrl(jobDescriptionFileUrl);
      } catch (error) {
        console.error('Job description file URL extraction failed:', error);
      }
    }

    if (!extractedResumeText || !extractedJobDescriptionText) {
      return NextResponse.json(
        { success: false, error: 'Both resume and job description are required' },
        { status: 200 }
      );
    }

    // Run both AI calls in parallel to reduce total time
    const [atsReport, parsedResumeData] = await Promise.all([
      generateATSReport(extractedResumeText, extractedJobDescriptionText),
      parseResumeStructure(extractedResumeText).catch(error => {
        console.error('Resume parse failed, using minimal structure:', error);
        return { rawText: extractedResumeText };
      })
    ]);

    return NextResponse.json({
      success: true,
      atsReport,
      parsedResumeData,
      extractedResumeText,
      extractedJobDescriptionText
    });

  } catch (error) {
    console.error('ATS Report generation error (final catch):', error);
    const atsReport = buildFallbackAtsReport('', '', error);
    return NextResponse.json({
      success: false,
      atsReport,
      parsedResumeData: { rawText: '' },
      extractedResumeText: '',
      extractedJobDescriptionText: ''
    });
  }
}

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  try {
    switch (fileExtension) {
      case 'pdf':
        // Use require for pdf-parse as it has issues with ES imports
        const pdf = require('pdf-parse');
        const pdfData = await pdf(Buffer.from(buffer));
        return pdfData.text;
      
      case 'docx':
        const mammoth = await import('mammoth');
        const docxResult = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        return docxResult.value;
      
      case 'doc':
        // For .doc files, we'll try mammoth as well, though it works better with .docx
        const mammothDoc = await import('mammoth');
        const docResult = await mammothDoc.extractRawText({ buffer: Buffer.from(buffer) });
        return docResult.value;
      
      case 'txt':
        return new TextDecoder().decode(buffer);
      
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  } catch (error) {
    console.error(`Error extracting text from ${fileExtension} file:`, error);
    throw new Error(`Failed to extract text from ${fileExtension} file`);
  }
}

async function extractTextFromFileUrl(fileUrl: string): Promise<string> {
  try {
    // Download the file from the URL
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const urlParts = fileUrl.split('.');
    const fileExtension = urlParts.length > 1 ? urlParts.pop()?.toLowerCase() : '';
    
    // Determine file type from extension or content-type
    const contentType = response.headers.get('content-type') || '';
    let detectedType = fileExtension;
    
    if (!detectedType) {
      if (contentType.includes('pdf')) detectedType = 'pdf';
      else if (contentType.includes('document')) detectedType = 'docx';
      else detectedType = 'txt';
    }

    switch (detectedType) {
      case 'pdf':
        // Use require for pdf-parse as it has issues with ES imports
        const pdf = require('pdf-parse');
        const pdfData = await pdf(Buffer.from(buffer));
        return pdfData.text;
      
      case 'docx':
        const mammoth = await import('mammoth');
        const docxResult = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        return docxResult.value;
      
      case 'doc':
        // For .doc files, we'll try mammoth as well, though it works better with .docx
        const mammothDoc = await import('mammoth');
        const docResult = await mammothDoc.extractRawText({ buffer: Buffer.from(buffer) });
        return docResult.value;
      
      case 'txt':
        return new TextDecoder().decode(buffer);
      
      default:
        // Try to decode as text if unsure
        return new TextDecoder().decode(buffer);
    }
  } catch (error) {
    console.error(`Error extracting text from file URL:`, error);
    throw new Error(`Failed to extract text from file URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function generateATSReport(resumeText: string, jobDescriptionText: string) {
  const client = getOpenAIClient();
  if (!client) {
    return buildFallbackAtsReport(resumeText, jobDescriptionText, new Error('Missing OPENROUTER_API_KEY'));
  }

  // Truncate inputs to reduce tokens
  const truncatedResume = resumeText.substring(0, 3000);
  const truncatedJD = jobDescriptionText.substring(0, 2000);

  const prompt = `Analyze resume vs job description. Return ONLY valid JSON, no markdown.

RESUME:
${truncatedResume}

JOB:
${truncatedJD}

Return this exact JSON structure (keep feedback short, max 50 words each):
{"overallScore":75,"matchPercentage":70,"keywordMatches":{"found":["skill1"],"missing":["skill2"]},"sections":{"skills":{"score":75,"feedback":"brief feedback","suggestions":["suggestion"]},"experience":{"score":75,"feedback":"brief feedback","suggestions":["suggestion"]},"education":{"score":75,"feedback":"brief feedback","suggestions":["suggestion"]},"formatting":{"score":75,"feedback":"brief feedback","suggestions":["suggestion"]}},"strengths":["strength1","strength2"],"improvementAreas":["area1"],"recommendations":["rec1","rec2"],"estimatedATSCompatibility":"Medium","summary":"One sentence summary"}`;

  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    console.log('Calling Nemotron model for ATS report...');
    response = await client.chat.completions.create({
      model: 'nvidia/nemotron-3-nano-30b-a3b:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2500,
    });
    console.log('Nemotron ATS response received');
  } catch (error) {
    console.error('OpenRouter completion failed:', error);
    return buildFallbackAtsReport(resumeText, jobDescriptionText, error);
  } finally {
    clearTimeout(timeout);
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    return buildFallbackAtsReport(resumeText, jobDescriptionText, new Error('No content returned from OpenRouter'));
  }
  console.log('Raw AI response for ATS report:', content);
  
  try {
    // Try to extract JSON from the response
    let jsonContent = content || '{}';
    
    // Remove markdown code blocks if present
    if (jsonContent.includes('```json')) {
      const jsonMatch = jsonContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
    } else if (jsonContent.includes('```')) {
      const jsonMatch = jsonContent.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
    }
    
    // Try to extract the first complete JSON object
    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
    
    // Attempt to fix truncated JSON by closing open structures
    jsonContent = attemptJsonRepair(jsonContent);
    
    console.log('Cleaned JSON content:', jsonContent);
    return JSON.parse(jsonContent);
  } catch (error) {
    console.error('Error parsing ATS report JSON:', error);
    console.error('Raw content was:', content);
    return buildFallbackAtsReport(resumeText, jobDescriptionText, error);
  }
}

// Helper function to attempt repairing truncated JSON
function attemptJsonRepair(jsonStr: string): string {
  let result = jsonStr.trim();
  
  // Count open brackets and braces
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let lastChar = '';
  
  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    if (char === '"' && lastChar !== '\\') {
      inString = !inString;
    }
    if (!inString) {
      if (char === '{') openBraces++;
      else if (char === '}') openBraces--;
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets--;
    }
    lastChar = char;
  }
  
  // If we're in a string, close it
  if (inString) {
    result += '"';
  }
  
  // Close any open brackets and braces
  while (openBrackets > 0) {
    result += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    result += '}';
    openBraces--;
  }
  
  return result;
}

async function parseResumeStructure(resumeText: string) {
  const client = getOpenAIClient();
  if (!client) {
    return { rawText: resumeText, error: 'Missing OPENROUTER_API_KEY' };
  }

  // Truncate resume to reduce processing time
  const truncatedResume = resumeText.substring(0, 4000);

  const prompt = `Parse this resume into JSON. Return ONLY valid JSON, no markdown.

RESUME:
${truncatedResume}

Return this exact structure (use null/empty arrays for missing info):
{"personalInfo":{"name":"","email":"","phone":"","location":"","linkedIn":null,"portfolio":null},"summary":"","skills":{"technical":[],"soft":[],"tools":[]},"experience":[{"title":"","company":"","duration":"","responsibilities":[]}],"education":[{"degree":"","institution":"","year":""}],"projects":[{"name":"","description":"","technologies":[]}],"certifications":[]}`;

  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    console.log('Calling Nemotron model for resume parsing...');
    response = await client.chat.completions.create({
      model: 'nvidia/nemotron-3-nano-30b-a3b:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2500,
    });
    console.log('Nemotron resume parse response received');
  } catch (error) {
    clearTimeout(timeout);
    console.error('OpenRouter resume parse failed:', error);
    return { rawText: resumeText, error: error instanceof Error ? error.message : 'Unknown error' };
  } finally {
    clearTimeout(timeout);
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    return { rawText: resumeText, error: 'No content returned from OpenRouter' };
  }
  console.log('Raw AI response for resume parsing:', content);
  
  try {
    // Try to extract JSON from the response if it's wrapped in markdown
    let jsonContent = content || '{}';
    
    // Remove markdown code blocks if present
    if (jsonContent.includes('```json')) {
      const jsonMatch = jsonContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
    } else if (jsonContent.includes('```')) {
      const jsonMatch = jsonContent.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
    }
    
    // Try to extract the first complete JSON object
    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
    
    // Attempt to fix truncated JSON
    jsonContent = attemptJsonRepair(jsonContent);
    
    console.log('Cleaned JSON content for resume:', jsonContent);
    return JSON.parse(jsonContent);
  } catch (error) {
    console.error('Error parsing resume structure JSON:', error);
    console.error('Raw content was:', content);
    // Return a fallback response
    return {
      personalInfo: {
        name: "Resume Owner",
        email: "",
        phone: "",
        location: "",
        linkedIn: "",
        portfolio: ""
      },
      summary: "Professional summary not extracted",
      skills: {
        technical: [],
        soft: [],
        tools: [],
        languages: []
      },
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      awards: [],
      publications: [],
      error: 'Used fallback data due to JSON parsing error',
      rawResponse: content
    };
  }
}

function buildFallbackAtsReport(resumeText: string, jobDescriptionText: string, error: unknown) {
  return {
    overallScore: 70,
    matchPercentage: 65,
    keywordMatches: {
      found: [],
      missing: []
    },
    sections: {
      skills: { score: 70, feedback: 'Placeholder feedback (fallback mode)', suggestions: [] },
      experience: { score: 70, feedback: 'Placeholder feedback (fallback mode)', suggestions: [] },
      education: { score: 70, feedback: 'Placeholder feedback (fallback mode)', suggestions: [] },
      formatting: { score: 70, feedback: 'Placeholder feedback (fallback mode)', suggestions: [] }
    },
    strengths: [],
    improvementAreas: [],
    recommendations: [],
    estimatedATSCompatibility: 'Medium',
    summary: 'Fallback ATS report returned because the model request failed.',
    error: error instanceof Error ? error.message : 'Unknown model error',
    rawResumeLength: resumeText?.length || 0,
    rawJobDescriptionLength: jobDescriptionText?.length || 0
  };
}