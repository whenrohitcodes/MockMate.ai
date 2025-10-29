import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Initialize OpenAI clients for different models
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// OpenRouter for alternative models
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const {
      sessionId,
      resumeContent,
      jobDescriptionContent,
      interviewType,
      difficulty,
      duration,
      aiModel
    } = await request.json();

    if (!resumeContent || !jobDescriptionContent) {
      return NextResponse.json(
        { error: 'Resume and job description are required' },
        { status: 400 }
      );
    }

    // Generate questions based on the configuration
    const questions = await generateInterviewQuestions({
      resumeContent,
      jobDescriptionContent,
      interviewType: interviewType || 'mixed',
      difficulty: difficulty || 'intermediate',
      duration: duration || 60,
      aiModel: aiModel || 'chatgpt'
    });

    return NextResponse.json({
      success: true,
      questions,
      sessionId
    });

  } catch (error) {
    console.error('Question generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate interview questions' },
      { status: 500 }
    );
  }
}

async function generateInterviewQuestions({
  resumeContent,
  jobDescriptionContent,
  interviewType,
  difficulty,
  duration,
  aiModel
}: {
  resumeContent: string;
  jobDescriptionContent: string;
  interviewType: string;
  difficulty: string;
  duration: number;
  aiModel: string;
}) {
  const questionCount = Math.ceil(duration / 5); // Roughly 5 minutes per question
  
  const prompt = `
You are an expert interviewer creating a ${difficulty} level ${interviewType} interview. Generate exactly ${questionCount} interview questions.

CANDIDATE'S RESUME:
${resumeContent}

JOB DESCRIPTION:
${jobDescriptionContent}

INTERVIEW SPECIFICATIONS:
- Type: ${interviewType}
- Difficulty: ${difficulty}
- Duration: ${duration} minutes
- Questions needed: ${questionCount}

QUESTION TYPES BASED ON INTERVIEW TYPE:
${getQuestionTypeGuidelines(interviewType)}

DIFFICULTY LEVEL GUIDELINES:
${getDifficultyGuidelines(difficulty)}

Generate exactly ${questionCount} questions in JSON format:
{
  "questions": [
    {
      "id": 1,
      "question": "Your question here",
      "type": "technical|behavioral|situational|general",
      "expectedDuration": "2-5 minutes",
      "difficulty": "${difficulty}",
      "category": "relevant skill/topic",
      "followUpSuggestions": ["potential follow-up question 1", "potential follow-up question 2"]
    }
  ]
}

IMPORTANT REQUIREMENTS:
1. Make questions specific to the candidate's background and the job requirements
2. Ensure questions are appropriate for the ${difficulty} difficulty level
3. Include a mix of question types appropriate for ${interviewType} interviews
4. Each question should be clear, concise, and open-ended
5. Include follow-up suggestions for deeper exploration
6. Avoid yes/no questions
7. Ensure questions can realistically be answered in the expected duration

Focus on creating questions that will help evaluate the candidate's fit for this specific role while giving them opportunities to showcase their relevant experience and skills.
`;

  let client = openai;
  let model = 'gpt-4o-mini';

  // Select appropriate model and client
  switch (aiModel) {
    case 'chatgpt':
      client = openai;
      model = 'gpt-4o-mini';
      break;
    case 'gemini':
      client = openrouter;
      model = 'google/gemini-2.0-flash-exp:free';
      break;
    case 'deepseek':
      client = openrouter;
      model = 'deepseek/deepseek-chat';
      break;
  }

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = response.choices[0].message.content;
  try {
    const result = JSON.parse(content || '{}');
    return result.questions || [];
  } catch (error) {
    console.error('Error parsing questions JSON:', error);
    // Fallback: create basic questions
    return generateFallbackQuestions(interviewType, questionCount, difficulty);
  }
}

function getQuestionTypeGuidelines(interviewType: string): string {
  switch (interviewType) {
    case 'technical':
      return `
- 70% Technical/Problem-solving questions
- 20% Experience-based technical questions  
- 10% Communication and teamwork in technical contexts
- Include coding problems, system design, or technical concepts
- Ask about specific technologies mentioned in resume/job description`;
    
    case 'behavioral':
      return `
- 60% Behavioral questions using STAR method
- 25% Situational/hypothetical scenarios
- 15% Cultural fit and motivation questions
- Focus on past experiences and how they handled situations
- Explore leadership, teamwork, conflict resolution`;
    
    case 'mixed':
      return `
- 40% Technical questions
- 40% Behavioral questions
- 20% Situational and general questions
- Balance technical competency with soft skills assessment
- Include both problem-solving and experience-based questions`;
    
    case 'hr':
      return `
- 50% Cultural fit and company alignment
- 30% Career goals and motivation
- 20% General background and communication
- Focus on personality, work style, and company fit
- Explore career aspirations and work preferences`;
    
    default:
      return 'Create a balanced mix of technical and behavioral questions.';
  }
}

function getDifficultyGuidelines(difficulty: string): string {
  switch (difficulty) {
    case 'beginner':
      return `
- Focus on fundamental concepts and basic applications
- Ask about learning experiences and growth mindset
- Include entry-level scenarios and simple problem-solving
- Avoid complex system design or advanced technical concepts
- Encourage explanation of basic principles`;
    
    case 'intermediate':
      return `
- Mix of fundamental and intermediate concepts
- Include real-world application scenarios
- Ask about past project experiences and decision-making
- Include some challenging but not expert-level problems
- Balance theory with practical experience`;
    
    case 'advanced':
      return `
- Focus on complex problem-solving and system thinking
- Include architecture and design decisions
- Ask about leadership, mentoring, and strategic thinking
- Include challenging technical problems and trade-offs
- Explore expertise depth and breadth`;
    
    default:
      return 'Adjust question complexity to match the candidate level.';
  }
}

function generateFallbackQuestions(interviewType: string, count: number, difficulty: string) {
  const fallbackQuestions = {
    technical: [
      "Tell me about a challenging technical problem you solved recently.",
      "How do you approach debugging a complex issue?",
      "Describe your experience with the main technologies mentioned in the job description.",
      "Walk me through your development process for a typical project.",
      "How do you stay updated with new technologies and best practices?"
    ],
    behavioral: [
      "Tell me about a time when you had to work with a difficult team member.",
      "Describe a situation where you had to meet a tight deadline.",
      "Give me an example of when you had to learn something new quickly.",
      "Tell me about a time when you made a mistake and how you handled it.",
      "Describe a project you're particularly proud of and why."
    ],
    mixed: [
      "Tell me about a technical project that required significant collaboration.",
      "How do you handle conflicting requirements from different stakeholders?",
      "Describe a time when you had to make a technical decision with incomplete information.",
      "Tell me about a time when you had to explain a complex technical concept to a non-technical person.",
      "How do you balance technical debt with feature development?"
    ],
    hr: [
      "What interests you most about this role and our company?",
      "Where do you see yourself in your career in 5 years?",
      "What kind of work environment do you thrive in?",
      "Tell me about your greatest professional achievement.",
      "Why are you looking to make a change from your current position?"
    ]
  };

  const questions = fallbackQuestions[interviewType as keyof typeof fallbackQuestions] || fallbackQuestions.mixed;
  
  return questions.slice(0, count).map((question, index) => ({
    id: index + 1,
    question,
    type: interviewType,
    expectedDuration: "3-5 minutes",
    difficulty,
    category: "general",
    followUpSuggestions: [
      "Can you provide more specific details about that?",
      "What would you do differently if you faced a similar situation again?"
    ]
  }));
}