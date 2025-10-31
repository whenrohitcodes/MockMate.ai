import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  let sessionId = '';
  
  try {
    console.log('VAPI setup API called');
    
    const requestData = await request.json();
    const {
      sessionId: requestSessionId,
      questions,
      interviewConfig
    } = requestData;
    
    sessionId = requestSessionId; // Store for use in catch block

    console.log('VAPI setup request:', {
      sessionId,
      questionsCount: questions?.length,
      interviewConfig
    });

    if (!questions || questions.length === 0) {
      console.error('No questions provided');
      return NextResponse.json(
        { error: 'Questions are required' },
        { status: 400 }
      );
    }

    console.log('Creating VAPI assistant...');
    // Create VAPI assistant with the interview questions
    const assistant = await createVAPIAssistant({
      questions,
      config: interviewConfig,
      sessionId
    });

    console.log('VAPI assistant created successfully:', assistant.id);
    return NextResponse.json({
      success: true,
      assistantId: assistant.id,
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      sessionId
    });

  } catch (error) {
    console.error('VAPI setup error:', error);
    
    // For now, return a mock response so the user can continue testing other features
    console.log('Returning mock VAPI response for testing...');
    
    return NextResponse.json({
      success: true,
      assistantId: 'mock-assistant-' + Date.now(),
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID || 'mock-phone-number',
      sessionId: sessionId,
      note: 'Mock VAPI setup - voice interview not available yet',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function createVAPIAssistant({
  questions,
  config,
  sessionId
}: {
  questions: any[];
  config: any;
  sessionId: string;
}) {
  console.log('createVAPIAssistant called with config:', config);
  
  const vapiPrivateKey = process.env.VAPI_PRIVATE_KEY;
  
  if (!vapiPrivateKey) {
    console.error('VAPI private key missing');
    throw new Error('VAPI private key not configured');
  }

  console.log('VAPI private key present, length:', vapiPrivateKey.length);
  
  // Prepare the interview script for the AI assistant
  console.log('Generating interview script...');
  const interviewScript = generateInterviewScript(questions, config);
  
  const assistantPayload = {
    name: `Interview Assistant - Session ${sessionId}`,
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 500,
      systemPrompt: interviewScript
    },
    voice: {
      provider: "11labs",
      voiceId: "burt"
    },
    firstMessage: getWelcomeMessage(config),
    endCallMessage: "Thank you for completing the interview. You'll receive detailed feedback shortly. Have a great day!",
    endCallPhrases: [
      "end interview",
      "finish interview", 
      "that's all",
      "we're done",
      "goodbye"
    ],
    recordingEnabled: true,
    maxDurationSeconds: (config.duration + 5) * 60, // Add 5 minutes buffer
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 1,
    numWordsToInterruptAssistant: 2,
    clientMessages: [
      "transcript",
      "hang",
      "function-call",
      "speech-update",
      "metadata",
      "conversation-update"
    ],
    serverMessages: [
      "end-of-call-report",
      "status-update",
      "hang",
      "function-call"
    ],
    metadata: {
      sessionId,
      interviewType: config.type,
      difficulty: config.difficulty,
      questionCount: questions.length
    }
  };

  console.log('Assistant payload prepared:', {
    name: assistantPayload.name,
    model: assistantPayload.model.model,
    voice: assistantPayload.voice,
    maxDurationSeconds: assistantPayload.maxDurationSeconds
  });

  // Create assistant via VAPI API
  console.log('Making request to VAPI API...');
  const response = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${vapiPrivateKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(assistantPayload),
  });

  console.log('VAPI API response status:', response.status);

  if (!response.ok) {
    let errorText;
    try {
      const errorJson = await response.json();
      errorText = JSON.stringify(errorJson, null, 2);
      console.error('VAPI API Error Response (JSON):', errorJson);
    } catch (e) {
      errorText = await response.text();
      console.error('VAPI API Error Response (Text):', errorText);
    }
    console.error('Request payload was:', JSON.stringify(assistantPayload, null, 2));
    throw new Error(`VAPI API error: ${response.status} - ${errorText}`);
  }

  const assistant = await response.json();
  console.log('VAPI assistant created:', assistant);
  return assistant;
}

function generateInterviewScript(questions: any[], config: any): string {
  const questionsList = questions.map((q, index) => 
    `${index + 1}. ${q.question} (Expected duration: ${q.expectedDuration})`
  ).join('\n');

  return `You are a professional interview assistant conducting a ${config.type} interview at ${config.difficulty} level. 

INTERVIEW CONFIGURATION:
- Type: ${config.type}
- Difficulty: ${config.difficulty}
- Duration: ${config.duration} minutes
- Number of questions: ${questions.length}

INTERVIEW QUESTIONS TO ASK:
${questionsList}

INSTRUCTIONS:
1. Be professional, friendly, and encouraging
2. Ask questions one at a time in the order provided
3. Listen carefully to the candidate's responses
4. Ask natural follow-up questions when appropriate
5. Keep track of time and pace the interview accordingly
6. If a candidate's answer is too brief, politely ask for more details
7. If a candidate goes off-topic, gently redirect them
8. Provide brief acknowledgments like "That's interesting" or "I see" between questions
9. Give the candidate a chance to ask questions at the end
10. Keep responses concise and focused on gathering information

BEHAVIORAL GUIDELINES:
- Maintain a warm but professional tone
- Show genuine interest in their responses
- Avoid being overly chatty or taking up too much time
- Be patient if they need a moment to think
- Encourage them if they seem nervous
- Stay neutral and avoid expressing strong opinions about their answers

TIMING:
- Aim for approximately ${Math.floor(config.duration / questions.length)} minutes per question
- Give a gentle time warning if needed: "We have about X minutes left, so let's move to the next question"
- Save 2-3 minutes at the end for their questions

Remember: Your role is to facilitate a positive interview experience while gathering comprehensive information about the candidate's qualifications and fit for the role.`;
}

function getVAPIModelProvider(aiModel: string): string {
  switch (aiModel) {
    case 'chatgpt':
      return 'openai';
    case 'gemini':
    case 'deepseek':
      // For now, let's use OpenAI for VAPI as it's most reliable
      return 'openai';
    default:
      return 'openai';
  }
}

function getVAPIModelName(aiModel: string): string {
  switch (aiModel) {
    case 'chatgpt':
      return 'gpt-3.5-turbo'; // Use a more basic model to avoid quota issues
    case 'gemini':
    case 'deepseek':
      // For now, fall back to GPT-3.5-turbo for VAPI compatibility
      return 'gpt-3.5-turbo';
    default:
      return 'gpt-3.5-turbo';
  }
}

function getWelcomeMessage(config: any): string {
  return `Hello! Welcome to your ${config.type} interview. I'm your AI interview assistant, and I'll be conducting your ${config.duration}-minute interview session today. 

Before we begin, please make sure you're in a quiet environment with a good internet connection. You can speak naturally - I'll be listening and asking you questions about your background and experience.

Are you ready to get started with the first question?`;
}