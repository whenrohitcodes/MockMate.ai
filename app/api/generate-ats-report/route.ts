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

    // Resume parsing is disabled; only generate ATS report.
    const atsReport = await generateATSReport(extractedResumeText, extractedJobDescriptionText);
    const parsedResumeData = { rawText: extractedResumeText };

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

  const prompt = `
Analyze the following resume against the job description to generate a comprehensive ATS (Applicant Tracking System) report.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescriptionText}

Please provide a detailed ATS analysis in the following JSON format:

{
  "overallScore": <number 0-100>,
  "matchPercentage": <number 0-100>,
  "keywordMatches": {
    "found": ["keyword1", "keyword2"],
    "missing": ["keyword3", "keyword4"]
  },
  "sections": {
    "skills": {
      "score": <number 0-100>,
      "feedback": "detailed feedback",
      "suggestions": ["suggestion1", "suggestion2"]
    },
    "experience": {
      "score": <number 0-100>,
      "feedback": "detailed feedback",
      "suggestions": ["suggestion1", "suggestion2"]
    },
    "education": {
      "score": <number 0-100>,
      "feedback": "detailed feedback",
      "suggestions": ["suggestion1", "suggestion2"]
    },
    "formatting": {
      "score": <number 0-100>,
      "feedback": "detailed feedback",
      "suggestions": ["suggestion1", "suggestion2"]
    }
  },
  "strengths": ["strength1", "strength2"],
  "improvementAreas": ["area1", "area2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "estimatedATSCompatibility": "<High/Medium/Low>",
  "summary": "Overall summary of the resume's performance against this job description"
}

Focus on:
1. Keyword matching between resume and job requirements
2. Skills alignment
3. Experience relevance
4. Education requirements
5. ATS-friendly formatting
6. Missing critical elements
7. Actionable improvement suggestions
`;

  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    console.log('Calling Mistral Small model for ATS report...');
    response = await client.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    });
    console.log('Mistral Small ATS response received');
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

/*
async function parseResumeStructure(resumeText: string) {
  const client = getOpenAIClient();
  if (!client) {
    return { rawText: resumeText, error: 'Missing OPENROUTER_API_KEY' };
  }

  const prompt = `
Parse the following resume and extract structured information in JSON format:

RESUME:
${resumeText}

Please extract and structure the information in the following JSON format:

{
  "personalInfo": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "phone number",
    "location": "city, state/country",
    "linkedIn": "linkedin profile",
    "portfolio": "portfolio/website url"
  },
  "summary": "Professional summary or objective",
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"],
    "tools": ["tool1", "tool2"],
    "languages": ["language1", "language2"]
  },
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Start Date - End Date",
      "location": "Location",
      "responsibilities": ["responsibility1", "responsibility2"],
      "achievements": ["achievement1", "achievement2"]
    }
  ],
  "education": [
    {
      "degree": "Degree Type",
      "institution": "Institution Name",
      "year": "Graduation Year",
      "gpa": "GPA if mentioned",
      "relevantCourses": ["course1", "course2"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Project Description",
      "technologies": ["tech1", "tech2"],
      "url": "project url if available"
    }
  ],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "Date Obtained"
    }
  ],
  "awards": ["award1", "award2"],
  "publications": ["publication1", "publication2"]
}

If any section is not found in the resume, use empty arrays or null values appropriately.
`;

  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    console.log('Calling Mistral Small model for resume parsing...');
    response = await client.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1500,
    });
    console.log('Mistral Small resume parse response received');
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
*/

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