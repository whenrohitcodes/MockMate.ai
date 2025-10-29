import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userAnswer, question, questionType, followUpSuggestions } = await request.json();

    if (!userAnswer || !question) {
      return NextResponse.json(
        { error: 'User answer and question are required' },
        { status: 400 }
      );
    }

    // Use OpenRouter with DeepSeek model for follow-up responses
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are an experienced AI interviewer conducting a ${questionType || 'professional'} interview. Your role is to:

1. Acknowledge the candidate's response professionally
2. Ask 1-2 relevant follow-up questions to dive deeper
3. Keep responses conversational and under 50 words
4. Be encouraging but professional
5. Focus on getting specific examples and details

Current question being discussed: "${question}"

Generate a natural, conversational follow-up response that encourages the candidate to elaborate or provide more specific details.`
          },
          {
            role: 'user',
            content: `The candidate just answered: "${userAnswer}"

Please provide a brief, encouraging follow-up response that asks for more specific details or examples. Keep it conversational and under 50 words.`
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', response.status, response.statusText);
      // Fallback response
      return NextResponse.json({
        response: "That's interesting! Can you tell me more about the specific challenges you faced and how you overcame them?"
      });
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content?.trim();

    if (!aiResponse) {
      // Fallback response
      return NextResponse.json({
        response: "Thank you for sharing that. Could you provide a specific example to illustrate your point?"
      });
    }

    return NextResponse.json({
      response: aiResponse
    });

  } catch (error) {
    console.error('Follow-up generation error:', error);
    
    // Fallback responses based on common interview scenarios
    const fallbackResponses = [
      "That's a great point! Can you walk me through a specific example?",
      "Interesting approach! What was the outcome of that situation?",
      "I'd love to hear more details about that experience.",
      "That sounds challenging! How did you handle the pressure?",
      "Can you elaborate on the steps you took to achieve that result?"
    ];
    
    const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    
    return NextResponse.json({
      response: randomResponse
    });
  }
}