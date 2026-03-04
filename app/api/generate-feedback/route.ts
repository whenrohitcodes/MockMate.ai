import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Use OpenRouter with Nemotron model
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'MockMate AI Interview',
  },
});

interface ConversationMessage {
  role: 'assistant' | 'user' | 'system';
  message: string;
  timestamp: string;
}

interface Question {
  id: number;
  question: string;
  type: string;
  category: string;
  difficulty: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      conversationHistory, 
      questions, 
      jobDescription, 
      resumeContent,
      interviewType,
      difficulty 
    } = body;

    console.log('Generate feedback request received');
    console.log('Conversation history length:', conversationHistory?.length);
    console.log('Questions length:', questions?.length);

    // Check if OpenRouter API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY is not configured');
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured' },
        { status: 500 }
      );
    }

    if (!conversationHistory || conversationHistory.length === 0) {
      console.warn('No conversation history provided, generating default feedback');
      // Return default feedback for empty conversation
      return NextResponse.json({
        success: true,
        feedback: {
          overallScore: 50,
          technicalScore: 50,
          communicationScore: 50,
          confidenceScore: 50,
          summary: 'Interview completed but the conversation transcript was not captured. Please try again with a new interview.',
          strengths: ['Completed the interview process'],
          areasForImprovement: ['Ensure microphone is working properly', 'Try the interview again for accurate feedback'],
          detailedFeedback: {},
          questionAnalysis: [],
          recommendations: [],
          interviewTips: ['Ensure your microphone is working before starting', 'Speak clearly and at a moderate pace'],
          overallImpression: 'The interview transcript was not captured properly. Please ensure your microphone is working and try again for detailed feedback.'
        }
      });
    }

    // Format conversation for analysis
    const formattedConversation = conversationHistory
      .filter((msg: ConversationMessage) => msg.role !== 'system')
      .map((msg: ConversationMessage) => `${msg.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${msg.message}`)
      .join('\n\n');

    console.log('Formatted conversation length:', formattedConversation.length);

    // If conversation is too short, provide basic feedback
    if (formattedConversation.length < 50) {
      console.warn('Conversation too short for meaningful analysis');
      return NextResponse.json({
        success: true,
        feedback: {
          overallScore: 55,
          technicalScore: 55,
          communicationScore: 55,
          confidenceScore: 55,
          summary: 'The interview was very brief. For more detailed feedback, please complete a full interview session.',
          strengths: ['Started the interview process'],
          areasForImprovement: ['Complete a full interview for comprehensive feedback'],
          detailedFeedback: {},
          questionAnalysis: [],
          recommendations: [{
            priority: 'high',
            area: 'Interview Completion',
            recommendation: 'Complete a full interview session to receive detailed feedback',
            resources: []
          }],
          interviewTips: ['Answer each question thoroughly', 'Take your time to provide complete responses'],
          overallImpression: 'The interview was too brief to provide comprehensive feedback. Please complete a full interview session.'
        }
      });
    }

    // Format questions for context
    const formattedQuestions = questions
      ?.map((q: Question) => `- ${q.question} (${q.type}, ${q.difficulty})`)
      .join('\n') || 'Questions not available';

    const systemPrompt = `You are an expert interview evaluator and career coach. Your task is to analyze a mock interview conversation and provide comprehensive, constructive feedback to help the candidate improve.

You must evaluate the candidate's performance across multiple dimensions and provide actionable insights.

IMPORTANT: Return your response as a valid JSON object with the following structure:
{
  "overallScore": <number 1-100>,
  "technicalScore": <number 1-100>,
  "communicationScore": <number 1-100>,
  "confidenceScore": <number 1-100>,
  "summary": "<brief 2-3 sentence overall summary>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "areasForImprovement": ["<area 1>", "<area 2>", ...],
  "detailedFeedback": {
    "technicalKnowledge": {
      "score": <number 1-100>,
      "feedback": "<detailed feedback>",
      "suggestions": ["<suggestion 1>", "<suggestion 2>"]
    },
    "communication": {
      "score": <number 1-100>,
      "feedback": "<detailed feedback>",
      "suggestions": ["<suggestion 1>", "<suggestion 2>"]
    },
    "problemSolving": {
      "score": <number 1-100>,
      "feedback": "<detailed feedback>",
      "suggestions": ["<suggestion 1>", "<suggestion 2>"]
    },
    "confidence": {
      "score": <number 1-100>,
      "feedback": "<detailed feedback>",
      "suggestions": ["<suggestion 1>", "<suggestion 2>"]
    },
    "structuredThinking": {
      "score": <number 1-100>,
      "feedback": "<detailed feedback>",
      "suggestions": ["<suggestion 1>", "<suggestion 2>"]
    }
  },
  "questionAnalysis": [
    {
      "question": "<question asked>",
      "responseQuality": "<excellent/good/fair/needs improvement>",
      "feedback": "<specific feedback for this response>",
      "betterApproach": "<suggestion for a better answer>"
    }
  ],
  "recommendations": [
    {
      "priority": "<high/medium/low>",
      "area": "<area name>",
      "recommendation": "<specific actionable recommendation>",
      "resources": ["<resource 1>", "<resource 2>"]
    }
  ],
  "interviewTips": ["<tip 1>", "<tip 2>", "<tip 3>"],
  "overallImpression": "<detailed paragraph about overall impression and potential>"
}`;

    const userPrompt = `Please analyze the following mock interview and provide detailed feedback.

**Interview Type:** ${interviewType || 'Mixed'}
**Difficulty Level:** ${difficulty || 'Intermediate'}

**Job Description Context:**
${jobDescription || 'Not provided'}

**Candidate Resume Summary:**
${resumeContent ? resumeContent.substring(0, 1500) + '...' : 'Not provided'}

**Interview Questions Prepared:**
${formattedQuestions}

**Interview Transcript:**
${formattedConversation}

Please provide comprehensive feedback to help this candidate improve their interview skills. Be constructive, specific, and actionable in your feedback.`;

    console.log('Calling Nemotron model via OpenRouter...');
    const response = await openai.chat.completions.create({
      model: 'nvidia/nemotron-3-nano-30b-a3b:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const feedbackText = response.choices[0]?.message?.content || '';
    console.log('Nemotron response received, length:', feedbackText.length);
    
    // Parse the JSON response
    let feedback;
    try {
      // Try to extract JSON from the response
      const jsonMatch = feedbackText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        feedback = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse feedback JSON:', parseError);
      // Return a basic structure if parsing fails
      feedback = {
        overallScore: 70,
        technicalScore: 70,
        communicationScore: 70,
        confidenceScore: 70,
        summary: 'Interview feedback generated but could not be fully parsed.',
        strengths: ['Completed the interview'],
        areasForImprovement: ['Review the full transcript for detailed analysis'],
        detailedFeedback: {},
        questionAnalysis: [],
        recommendations: [],
        interviewTips: ['Practice more mock interviews'],
        overallImpression: feedbackText,
        rawResponse: feedbackText
      };
    }

    console.log('Successfully generated feedback, overall score:', feedback.overallScore);

    return NextResponse.json({
      success: true,
      feedback
    });

  } catch (error) {
    console.error('Feedback generation error:', error);
    
    // Return a default feedback object instead of error
    // This ensures the user always gets some feedback
    return NextResponse.json({
      success: true,
      feedback: {
        overallScore: 60,
        technicalScore: 60,
        communicationScore: 60,
        confidenceScore: 60,
        summary: 'We encountered an issue generating detailed feedback. Please try again.',
        strengths: ['Participated in the interview'],
        areasForImprovement: ['Try the interview again for detailed analysis'],
        detailedFeedback: {},
        questionAnalysis: [],
        recommendations: [],
        interviewTips: ['Practice regularly to improve'],
        overallImpression: `There was an error generating your feedback: ${error instanceof Error ? error.message : 'Unknown error'}. Please try a new interview session.`
      }
    });
  }
}
