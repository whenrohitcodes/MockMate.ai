"use client";

import { useState, useEffect, use, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { redirect, useRouter } from 'next/navigation';
import { Id } from '../../../../convex/_generated/dataModel';

export default function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userResponse, setUserResponse] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{speaker: 'ai' | 'user', message: string, timestamp: Date}>>([]);
  const [isListening, setIsListening] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  
  // Unwrap the params Promise
  const { sessionId } = use(params);

  // Get user data from Convex
  const convexUser = useQuery(api.users.getUserByClerkId, 
    user?.id ? { clerkId: user.id } : "skip"
  );

  // Get session data
  const session = useQuery(api.interviewSessions.getSessionById, 
    sessionId ? { sessionId: sessionId as Id<"interviewSessions"> } : "skip"
  );

  // Convex mutations
  const updateSession = useMutation(api.interviewSessions.updateSession);

  // Get questions and current question
  const questions = session?.generatedQuestions || [];
  const currentQuestion = questions[currentQuestionIndex];

  // Speech functions
  const speakText = (text: string) => {
    try {
      console.log('Speaking text:', text.substring(0, 50) + '...');
      if (synthRef.current) {
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        utterance.onstart = () => {
          console.log('Speech started');
          setIsAiSpeaking(true);
        };
        utterance.onend = () => {
          console.log('Speech ended');
          setIsAiSpeaking(false);
        };
        utterance.onerror = (event) => {
          console.error('Speech synthesis error:', event);
          setIsAiSpeaking(false);
        };
        
        synthRef.current.speak(utterance);
      } else {
        console.error('Speech synthesis not available');
      }
    } catch (error) {
      console.error('Error in speakText:', error);
      setIsAiSpeaking(false);
    }
  };

  // Initialize speech recognition and synthesis
  useEffect(() => {
    console.log('Initializing speech APIs...');
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
      console.log('Speech synthesis available:', !!synthRef.current);
      
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        console.log('Speech recognition available');
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setUserResponse(finalTranscript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setError('Speech recognition error. Please try again.');
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      } else {
        console.warn('Speech recognition not supported in this browser');
        setError('Speech recognition is not supported in your browser. Please use Chrome or Edge for the best experience.');
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Start interview with AI greeting
  useEffect(() => {
    if (isInterviewActive && conversationHistory.length === 0 && questions.length > 0) {
      console.log('Starting interview with greeting...');
      const greeting = `Hello! I'm your AI interviewer. Let's begin with your first question: ${questions[0]?.question}`;
      speakText(greeting);
      setConversationHistory([{
        speaker: 'ai',
        message: greeting,
        timestamp: new Date()
      }]);
    }
  }, [isInterviewActive, questions.length]); // Remove conversationHistory.length to prevent infinite loop

  if (!isLoaded) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="loading-spinner-large"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    redirect('/sign-in');
    return null;
  }

  if (!session) {
    return (
      <div className="dashboard-container">
        <div className="error-container">
          <h2 className="error-title">Session Not Found</h2>
          <button onClick={() => router.push('/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (session.status !== 'interview_ready' && session.status !== 'in_progress') {
    return (
      <div className="dashboard-container">
        <div className="error-container">
          <h2 className="error-title">Interview Not Ready</h2>
          <p>This interview session is not ready yet. Please complete the setup first.</p>
          <button onClick={() => router.push(`/dashboard/interview-setup/${sessionId}`)} className="btn-primary">
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  const startListening = () => {
    try {
      console.log('Starting speech recognition...');
      if (recognitionRef.current && !isListening) {
        setUserResponse('');
        setIsListening(true);
        recognitionRef.current.start();
      } else if (!recognitionRef.current) {
        console.error('Speech recognition not available');
        setError('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setError('Failed to start speech recognition. Please try again.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (userResponse.trim()) {
        handleUserResponse(userResponse);
      }
    }
  };

  const handleUserResponse = async (response: string) => {
    // Clear the current response
    setUserResponse('');
    
    // Add user response to conversation
    const userMessage = {
      speaker: 'user' as const,
      message: response,
      timestamp: new Date()
    };
    
    setConversationHistory(prev => [...prev, userMessage]);

    try {
      // Generate AI follow-up response
      const aiFollowUp = await generateAIResponse(response, currentQuestion);
      
      const aiMessage = {
        speaker: 'ai' as const,
        message: aiFollowUp,
        timestamp: new Date()
      };
      
      setConversationHistory(prev => [...prev, aiMessage]);
      speakText(aiFollowUp);
      
    } catch (error) {
      console.error('Failed to generate AI response:', error);
      const errorMessage = "Thank you for your response. Let's move to the next question.";
      setConversationHistory(prev => [...prev, {
        speaker: 'ai',
        message: errorMessage,
        timestamp: new Date()
      }]);
      speakText(errorMessage);
    }
  };

  const generateAIResponse = async (userAnswer: string, question: any) => {
    const response = await fetch('/api/generate-followup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAnswer,
        question: question?.question,
        questionType: question?.type,
        followUpSuggestions: question?.followUpSuggestions || []
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate AI response');
    }

    const result = await response.json();
    return result.response;
  };

  const moveToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      const nextQuestion = questions[nextIndex];
      
      if (nextQuestion?.question) {
        const questionText = `Great! Now let's move to question ${nextIndex + 1}: ${nextQuestion.question}`;
        
        setConversationHistory(prev => [...prev, {
          speaker: 'ai',
          message: questionText,
          timestamp: new Date()
        }]);
        speakText(questionText);
      }
    } else {
      const closingMessage = "That concludes our interview. Thank you for your time! Let me prepare your feedback.";
      setConversationHistory(prev => [...prev, {
        speaker: 'ai',
        message: closingMessage,
        timestamp: new Date()
      }]);
      speakText(closingMessage);
      setTimeout(() => endInterview(), 3000);
    }
  };

  const startInterview = async () => {
    try {
      setIsInterviewActive(true);
      await updateSession({
        sessionId: sessionId as Id<"interviewSessions">,
        updates: {
          status: 'in_progress'
        }
      });
    } catch (error) {
      console.error('Failed to start interview:', error);
      setError('Failed to start interview. Please try again.');
    }
  };

  const endInterview = async () => {
    try {
      await updateSession({
        sessionId: sessionId as Id<"interviewSessions">,
        updates: {
          status: 'completed',
          completedAt: Date.now()
        }
      });
      router.push(`/dashboard/interview-results/${sessionId}`);
    } catch (error) {
      console.error('Failed to end interview:', error);
      setError('Failed to end interview. Please try again.');
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      endInterview();
    }
  };

  if (!isInterviewActive) {
    return (
      <div className="dashboard-container">
        <div className="journey-container">
          <div className="dashboard-card journey-card">
            <div className="interview-start">
              <div className="start-header">
                <h1 className="start-title">Ready to Begin Your Interview</h1>
                <p className="start-subtitle">
                  You have {questions.length} personalized questions prepared
                </p>
              </div>

              <div className="interview-info">
                <div className="info-grid">
                  <div className="info-item">
                    <div className="info-icon">⏱️</div>
                    <div className="info-content">
                      <h3>Duration</h3>
                      <p>{session.interviewDuration || 60} minutes</p>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-icon">🎯</div>
                    <div className="info-content">
                      <h3>Type</h3>
                      <p>{session.interviewType || 'Mixed'} Interview</p>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-icon">📊</div>
                    <div className="info-content">
                      <h3>Difficulty</h3>
                      <p>{session.difficulty || 'Intermediate'}</p>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-icon">🎙️</div>
                    <div className="info-content">
                      <h3>Format</h3>
                      <p>Voice Interview</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="interview-tips">
                <h3>Quick Tips</h3>
                <ul>
                  <li>Speak clearly and at a moderate pace</li>
                  <li>Take your time to think before answering</li>
                  <li>Provide specific examples when possible</li>
                  <li>You can pause and resume if needed</li>
                </ul>
              </div>

              <div className="start-actions">
                <button 
                  onClick={() => router.push(`/dashboard/interview-setup/${sessionId}`)}
                  className="btn-secondary"
                >
                  Back to Setup
                </button>
                <button 
                  onClick={startInterview}
                  className="btn-primary btn-large"
                >
                  Start Interview
                </button>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="journey-container">
        <div className="dashboard-card journey-card interview-active">
          {/* Interview Header */}
          <div className="interview-header">
            <div className="interview-progress">
              <span className="question-counter">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                ></div>
              </div>
            </div>
            <button 
              onClick={endInterview}
              className="btn-secondary btn-small"
            >
              End Interview
            </button>
          </div>

          {/* Conversation Interface */}
          <div className="conversation-container">
            {/* Conversation History */}
            <div className="conversation-history">
              {conversationHistory.map((entry, index) => (
                <div key={index} className={`conversation-entry ${entry.speaker}`}>
                  <div className="speaker-avatar">
                    {entry.speaker === 'ai' ? '🤖' : '👤'}
                  </div>
                  <div className="message-content">
                    <div className="speaker-name">
                      {entry.speaker === 'ai' ? 'AI Interviewer' : 'You'}
                    </div>
                    <div className="message-text">{entry.message}</div>
                    <div className="timestamp">
                      {entry.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {isAiSpeaking && (
                <div className="conversation-entry ai speaking">
                  <div className="speaker-avatar">🤖</div>
                  <div className="message-content">
                    <div className="speaker-name">AI Interviewer</div>
                    <div className="message-text speaking-indicator">
                      <span>Speaking...</span>
                      <div className="dots">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Voice Controls */}
            <div className="voice-controls">
              <div className="current-question-display">
                <span className="question-label">Current Question {currentQuestionIndex + 1}:</span>
                <span className="question-text">{currentQuestion?.question}</span>
              </div>
              
              <div className="voice-interface">
                <div className={`voice-status ${isListening ? 'listening' : isAiSpeaking ? 'ai-speaking' : 'ready'}`}>
                  {isListening ? (
                    <>
                      <div className="pulse-animation"></div>
                      <span>Listening... Speak now</span>
                    </>
                  ) : isAiSpeaking ? (
                    <>
                      <div className="speaking-animation"></div>
                      <span>AI is speaking...</span>
                    </>
                  ) : (
                    <span>Ready to listen</span>
                  )}
                </div>

                <div className="voice-controls-buttons">
                  {recognitionRef.current ? (
                    <>
                      <button 
                        onClick={startListening}
                        disabled={isListening || isAiSpeaking}
                        className="btn-voice btn-start-listening"
                      >
                        🎙️ Start Speaking
                      </button>
                      
                      <button 
                        onClick={stopListening}
                        disabled={!isListening}
                        className="btn-voice btn-stop-listening"
                      >
                        ⏹️ Stop & Submit
                      </button>
                    </>
                  ) : (
                    <div className="text-input-fallback">
                      <textarea
                        value={userResponse}
                        onChange={(e) => setUserResponse(e.target.value)}
                        placeholder="Type your response here (speech recognition not available)..."
                        className="response-textarea"
                        disabled={isAiSpeaking}
                      />
                      <button 
                        onClick={() => {
                          if (userResponse.trim()) {
                            handleUserResponse(userResponse);
                          }
                        }}
                        disabled={!userResponse.trim() || isAiSpeaking}
                        className="btn-voice btn-submit-text"
                      >
                        📝 Submit Response
                      </button>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => synthRef.current?.cancel()}
                    disabled={!isAiSpeaking}
                    className="btn-voice btn-stop-ai"
                  >
                    🔇 Stop AI
                  </button>
                </div>

                {userResponse && (
                  <div className="current-response">
                    <strong>Your current response:</strong>
                    <p>{userResponse}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="interview-navigation">
            <button 
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0 || isAiSpeaking}
              className="btn-secondary"
            >
              Previous Question
            </button>
            <button 
              onClick={moveToNextQuestion}
              disabled={isAiSpeaking}
              className="btn-primary"
            >
              {currentQuestionIndex === questions.length - 1 ? 'Finish Interview' : 'Next Question'}
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}