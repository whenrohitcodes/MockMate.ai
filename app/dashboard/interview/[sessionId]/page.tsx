"use client";

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { redirect, useRouter } from 'next/navigation';
import { Id } from '../../../../convex/_generated/dataModel';
import Vapi from '@vapi-ai/web';

interface ConversationMessage {
  role: 'assistant' | 'user' | 'system';
  message: string;
  timestamp: Date;
  isComplete: boolean;
}

export default function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  // Unwrap the params Promise
  const { sessionId } = use(params);

  // Get session data
  const session = useQuery(api.interviewSessions.getSessionById, 
    sessionId ? { sessionId: sessionId as Id<"interviewSessions"> } : "skip"
  );

  // Convex mutations
  const updateSession = useMutation(api.interviewSessions.updateSession);

  // VAPI state
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false);
  const [userIsSpeaking, setUserIsSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [currentBuffer, setCurrentBuffer] = useState<{role: 'assistant' | 'user', text: string} | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  
  // Use a ref to track conversation history for the callback
  const conversationHistoryRef = useRef<ConversationMessage[]>([]);
  
  // Track if interview actually happened (user spoke or AI asked questions)
  const [interviewStarted, setInterviewStarted] = useState(false);
  const interviewStartedRef = useRef(false);
  const callEndedDueToErrorRef = useRef(false);

  // Get questions
  const questions = session?.generatedQuestions || [];
  const questionsRef = useRef(questions);

  // Keep refs in sync with state
  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [conversationHistory]);

  // State for feedback generation
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [feedbackProgress, setFeedbackProgress] = useState('');

  // Handle call end
  const handleCallEnd = useCallback(async () => {
    try {
      setIsGeneratingFeedback(true);
      setFeedbackProgress('Saving interview data...');

      // First save the conversation history
      await updateSession({
        sessionId: sessionId as Id<"interviewSessions">,
        updates: {
          status: 'generating_feedback',
          completedAt: Date.now()
        }
      });

      setFeedbackProgress('Analyzing your responses...');

      // Use refs to get the latest conversation history (avoids stale closure)
      const currentConversation = conversationHistoryRef.current;
      const currentQuestions = questionsRef.current;
      
      console.log('Generating feedback with conversation:', currentConversation.length, 'messages');
      console.log('Questions:', currentQuestions.length);

      // Get the full conversation history from ref
      const fullConversation = currentConversation.map(msg => ({
        role: msg.role,
        message: msg.message,
        timestamp: msg.timestamp.toISOString()
      }));

      // If conversation is empty, create a placeholder
      if (fullConversation.length === 0) {
        console.warn('No conversation history captured. Adding placeholder.');
        fullConversation.push({
          role: 'system',
          message: 'Interview completed but transcript was not captured.',
          timestamp: new Date().toISOString()
        });
      }

      // Generate AI feedback
      const feedbackResponse = await fetch('/api/generate-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationHistory: fullConversation,
          questions: currentQuestions,
          jobDescription: session?.jobDescriptionContent,
          resumeContent: session?.resumeContent,
          interviewType: session?.interviewType,
          difficulty: session?.difficulty
        })
      });

      if (!feedbackResponse.ok) {
        const errorText = await feedbackResponse.text();
        console.error('Feedback API error:', errorText);
        throw new Error('Failed to generate feedback');
      }

      const { feedback } = await feedbackResponse.json();
      
      console.log('Received feedback:', feedback);
      
      setFeedbackProgress('Saving feedback...');

      // Save feedback to database
      await updateSession({
        sessionId: sessionId as Id<"interviewSessions">,
        updates: {
          status: 'completed',
          overallScore: feedback.overallScore || 0,
          technicalScore: feedback.technicalScore || 0,
          communicationScore: feedback.communicationScore || 0,
          confidenceScore: feedback.confidenceScore || 0,
          feedbackData: JSON.stringify(feedback),
          strengths: feedback.strengths || [],
          improvementAreas: feedback.areasForImprovement || []
        }
      });

      setFeedbackProgress('Complete! Redirecting to feedback...');
      
      // Redirect to feedback page
      setTimeout(() => {
        router.push(`/dashboard/feedback/${sessionId}`);
      }, 1000);
    } catch (error) {
      console.error('Failed to generate feedback:', error);
      setFeedbackProgress('Error generating feedback. Redirecting...');
      
      // Update status to completed even if feedback fails
      try {
        await updateSession({
          sessionId: sessionId as Id<"interviewSessions">,
          updates: {
            status: 'completed',
            completedAt: Date.now()
          }
        });
      } catch (e) {
        console.error('Failed to update session:', e);
      }
      
      // Redirect to dashboard if feedback generation fails
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    }
  }, [sessionId, updateSession, router, session]);

  // Initialize VAPI client
  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!publicKey || publicKey === 'your_vapi_public_key_here') {
      setError('VAPI API keys are not configured. Please add your VAPI Public Key to the .env.local file. Get your keys from https://dashboard.vapi.ai');
      return;
    }

    const vapiClient = new Vapi(publicKey);
    setVapi(vapiClient);

    // Set up event listeners
    vapiClient.on('call-start', () => {
      console.log('Call started');
      setIsCallActive(true);
      setIsConnecting(false);
      callEndedDueToErrorRef.current = false; // Reset error flag
      setConversationHistory([{
        role: 'system',
        message: 'Call connected. The AI interviewer will begin shortly.',
        timestamp: new Date(),
        isComplete: true
      }]);
    });

    vapiClient.on('call-end', () => {
      console.log('Call ended, interviewStarted:', interviewStartedRef.current, 'errorOccurred:', callEndedDueToErrorRef.current);
      setIsCallActive(false);
      setIsConnecting(false);
      setAssistantIsSpeaking(false);
      // Add any buffered message before ending
      if (currentBuffer) {
        setConversationHistory(prev => [...prev, {
          role: currentBuffer.role,
          message: currentBuffer.text,
          timestamp: new Date(),
          isComplete: true
        }]);
        setCurrentBuffer(null);
      }
      
      // Only generate feedback if interview actually happened and didn't end due to error
      if (interviewStartedRef.current && !callEndedDueToErrorRef.current) {
        handleCallEnd();
      } else {
        console.log('Skipping feedback generation - interview did not happen properly');
        // Don't redirect, let user try again
      }
    });

    vapiClient.on('speech-start', () => {
      console.log('Assistant started speaking');
      setAssistantIsSpeaking(true);
      // Mark interview as actually started when AI begins speaking
      if (!interviewStartedRef.current) {
        setInterviewStarted(true);
        interviewStartedRef.current = true;
        console.log('Interview marked as started');
      }
      // Start buffering assistant message
      setCurrentBuffer({ role: 'assistant', text: '' });
    });

    vapiClient.on('speech-end', () => {
      console.log('Assistant stopped speaking');
      setAssistantIsSpeaking(false);
      // Commit the buffered assistant message
      if (currentBuffer && currentBuffer.role === 'assistant' && currentBuffer.text.trim()) {
        setConversationHistory(prev => [...prev, {
          role: 'assistant',
          message: currentBuffer.text,
          timestamp: new Date(),
          isComplete: true
        }]);
        setCurrentBuffer(null);
      }
    });

    vapiClient.on('volume-level', (level: number) => {
      setVolumeLevel(level);
      // Detect user speaking based on volume level
      if (!assistantIsSpeaking) {
        setUserIsSpeaking(level > 5); // Lower threshold for better detection
      }
    });

    vapiClient.on('message', (message: any) => {
      console.log('Message received:', message);
      
      // Handle transcript messages - buffer them instead of showing immediately
      if (message.type === 'transcript' && message.transcript) {
        const text = message.transcript.trim();
        if (!text) return;

        if (message.role === 'assistant') {
          // Buffer assistant messages (will be committed on speech-end)
          setCurrentBuffer(prev => ({
            role: 'assistant',
            text: prev?.role === 'assistant' ? prev.text + ' ' + text : text
          }));
        } else if (message.role === 'user') {
          // Buffer user messages
          setCurrentBuffer(prev => {
            if (prev?.role === 'user') {
              // Continue buffering user message
              return { role: 'user', text: prev.text + ' ' + text };
            } else {
              // If there was an assistant message, commit it first
              if (prev?.role === 'assistant' && prev.text.trim()) {
                setConversationHistory(prevHistory => [...prevHistory, {
                  role: 'assistant',
                  message: prev.text,
                  timestamp: new Date(),
                  isComplete: true
                }]);
              }
              // Start new user message buffer
              return { role: 'user', text: text };
            }
          });
        }

        // Detect when user stops speaking (pause detection)
        // We'll use a timeout to commit user messages
        if (message.role === 'user') {
          // Clear any existing timeout
          if ((window as any).userSpeechTimeout) {
            clearTimeout((window as any).userSpeechTimeout);
          }
          // Set new timeout to commit message after 2 seconds of silence
          (window as any).userSpeechTimeout = setTimeout(() => {
            setCurrentBuffer(prev => {
              if (prev?.role === 'user' && prev.text.trim()) {
                setConversationHistory(prevHistory => [...prevHistory, {
                  role: 'user',
                  message: prev.text,
                  timestamp: new Date(),
                  isComplete: true
                }]);
                return null;
              }
              return prev;
            });
          }, 2000);
        }
      }

      // Handle conversation updates
      if (message.type === 'conversation-update') {
        console.log('Conversation update:', message);
      }
      
      // Log all message types for debugging
      if (message.type === 'status-update') {
        console.log('Status update:', message);
      }
      
      // Handle error messages from the call
      if (message.type === 'error' || message.error) {
        console.error('Call message error:', message);
      }
    });

    vapiClient.on('error', (error: any) => {
      console.error('VAPI error event:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Mark that call ended due to error - prevent feedback generation
      callEndedDueToErrorRef.current = true;
      
      // Provide more helpful error messages based on error type
      let errorMessage = 'Call error: ';
      const errorStr = JSON.stringify(error).toLowerCase();
      const errorMsg = error?.errorMsg || error?.error?.msg || error?.message || '';
      const nestedErrorMsg = error?.error?.error?.message || '';
      
      if (errorStr.includes('invalid key') || nestedErrorMsg.includes('Invalid Key') || errorStr.includes('unauthorized')) {
        errorMessage = 'VAPI API Key Error: Your VAPI keys are invalid or misconfigured. Please check that:\n\n• NEXT_PUBLIC_VAPI_PUBLIC_KEY has your PUBLIC key (not private)\n• VAPI_PRIVATE_KEY has your PRIVATE key\n• Keys are from https://dashboard.vapi.ai\n\nRestart the dev server after updating .env.local';
      } else if (errorStr.includes('ejection') || errorStr.includes('ejected') || errorMsg.includes('Meeting has ended')) {
        errorMessage = 'The interview call was disconnected. This can happen if:\n• Your microphone is not working properly\n• The AI could not hear your audio\n• There was a network interruption\n\nPlease check your microphone settings and try again.';
      } else if (errorStr.includes('microphone') || errorStr.includes('audio') || errorStr.includes('media')) {
        errorMessage = 'Microphone error: Please ensure your microphone is connected, working, and you have granted browser permission to use it.';
      } else if (errorStr.includes('network') || errorStr.includes('connection')) {
        errorMessage = 'Network error: Please check your internet connection and try again.';
      } else if (errorStr.includes('timeout')) {
        errorMessage = 'Connection timed out. Please check your internet connection and try again.';
      } else {
        errorMessage += errorMsg || nestedErrorMsg || 'Unknown error occurred. Please try again.';
      }
      
      setError(errorMessage);
      setIsCallActive(false);
      setIsConnecting(false);
      
      // Reset interview started flag so user can retry
      setInterviewStarted(false);
      interviewStartedRef.current = false;
    });

    return () => {
      if (vapiClient) {
        vapiClient.stop();
      }
      // Clear any pending timeouts
      if ((window as any).userSpeechTimeout) {
        clearTimeout((window as any).userSpeechTimeout);
      }
    };
  }, [handleCallEnd]);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive]);

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

  // Allow interview_ready, in_progress, generating_feedback, and completed statuses
  const allowedStatuses = ['interview_ready', 'in_progress', 'generating_feedback', 'completed'];
  if (!allowedStatuses.includes(session.status)) {
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

  // If already completed, redirect to feedback page
  if (session.status === 'completed' && !isGeneratingFeedback) {
    router.push(`/dashboard/feedback/${sessionId}`);
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="loading-spinner-large"></div>
          <p>Redirecting to feedback...</p>
        </div>
      </div>
    );
  }

  const startCall = async () => {
    if (!vapi) {
      setError('VAPI is not initialized properly. Please try refreshing the page.');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      setCallDuration(0);
      
      // Reset tracking flags for new call attempt
      callEndedDueToErrorRef.current = false;
      setInterviewStarted(false);
      interviewStartedRef.current = false;

      // Check microphone permission first
      try {
        console.log('Requesting microphone permission...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the test stream immediately
        stream.getTracks().forEach(track => track.stop());
        console.log('Microphone permission granted');
      } catch (micError) {
        console.error('Microphone permission denied:', micError);
        setError('Microphone access is required for the interview. Please allow microphone access and try again.');
        setIsConnecting(false);
        return;
      }

      // Update session status
      await updateSession({
        sessionId: sessionId as Id<"interviewSessions">,
        updates: {
          status: 'in_progress'
        }
      });

      // Always use inline assistant configuration (works with just public key)
      // Create interview script
      const interviewScript = `You are a professional interview assistant conducting a ${session.interviewType || 'mixed'} interview at ${session.difficulty || 'intermediate'} level.

INTERVIEW QUESTIONS:
${questions.map((q, idx) => `${idx + 1}. ${q.question}`).join('\n')}

INSTRUCTIONS:
1. Be professional, friendly, and encouraging
2. Ask questions one at a time in order
3. Listen carefully to responses
4. Ask natural follow-up questions when appropriate
5. Keep track of time and pace accordingly
6. Provide brief acknowledgments between questions
7. Stay neutral and objective

Start by greeting the candidate and asking the first question.`;

        // Use VAPI's built-in providers that work with free tier
        console.log('Starting call with VAPI built-in providers...');
        try {
          await vapi.start({
            model: {
              provider: "openai",
              model: "gpt-3.5-turbo",
              messages: [
                {
                  role: "system",
                  content: interviewScript
                }
              ],
              temperature: 0.7
            },
            voice: {
              provider: "11labs",
              voiceId: "burt"
            },
            transcriber: {
              provider: "deepgram",
              model: "nova-2",
              language: "en"
            },
            name: "Interview Assistant",
            firstMessage: `Hello! Welcome to your ${session.interviewType || 'mixed'} interview. I'm your AI interview assistant. Are you ready to get started with the first question?`,
            // silenceTimeoutSeconds: 120,
            maxDurationSeconds: (session.interviewDuration || 30) * 60
          });
        } catch (startError: any) {
          console.error('Failed to start with 11labs, trying azure:', startError);
          // Try with azure voice as alternative
          await vapi.start({
            model: {
              provider: "openai",
              model: "gpt-3.5-turbo",
              messages: [
                {
                  role: "system",
                  content: interviewScript
                }
              ],
              temperature: 0.7
            },
            voice: {
              provider: "azure",
              voiceId: "en-US-JennyNeural"
            },
            transcriber: {
              provider: "deepgram",
              model: "nova-2",
              language: "en"
            },
            name: "Interview Assistant",
            firstMessage: `Hello! Welcome to your ${session.interviewType || 'mixed'} interview. I'm your AI interview assistant. Are you ready to get started with the first question?`,
            // silenceTimeoutSeconds: 120,
            maxDurationSeconds: (session.interviewDuration || 30) * 60
          });
        }
      
    } catch (error) {
      console.error('Failed to start call:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      setError(`Failed to start interview: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  const endCall = async () => {
    console.log('endCall called, isCallActive:', isCallActive, 'vapi:', !!vapi);
    
    // Always update UI state first
    setIsCallActive(false);
    setIsConnecting(false);
    
    if (vapi) {
      try {
        vapi.stop();
        console.log('VAPI stop called successfully');
      } catch (e) {
        console.error('Error stopping VAPI:', e);
      }
    }
    
    // Always trigger the end flow
    handleCallEnd();
  };

  const toggleMute = () => {
    if (!vapi) {
      console.warn('Cannot toggle mute: VAPI not initialized');
      return;
    }
    
    if (!isCallActive) {
      console.warn('Cannot toggle mute: Call not active');
      return;
    }
    
    const newMuteState = !isMuted;
    
    try {
      // Try to set muted state on VAPI, but don't fail if call object isn't available
      if (typeof vapi.setMuted === 'function') {
        vapi.setMuted(newMuteState);
      }
    } catch (error) {
      // Ignore VAPI errors - call object may not be available
      console.warn('VAPI setMuted warning (non-critical):', error);
    }
    
    // Always update the UI state
    setIsMuted(newMuteState);
    console.log('Mute toggled to:', newMuteState);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Feedback generation view
  if (isGeneratingFeedback) {
    return (
      <div className="dashboard-container">
        <div className="feedback-generation-page">
          <div className="feedback-gen-card">
            {/* Animated background */}
            <div className="feedback-gen-bg">
              <div className="bg-circle bg-circle-1"></div>
              <div className="bg-circle bg-circle-2"></div>
              <div className="bg-circle bg-circle-3"></div>
            </div>
            
            {/* Content */}
            <div className="feedback-gen-content">
              {/* Animated icon */}
              <div className="feedback-gen-icon">
                <div className="icon-ring icon-ring-outer"></div>
                <div className="icon-ring icon-ring-middle"></div>
                <div className="icon-ring icon-ring-inner"></div>
                <div className="icon-center">
                  <span className="icon-emoji">🎯</span>
                </div>
              </div>
              
              {/* Title */}
              <h1 className="feedback-gen-title">Analyzing Your Interview</h1>
              
              {/* Progress status */}
              <div className="feedback-gen-status">
                <div className="status-dot"></div>
                <span className="status-text-animated">{feedbackProgress}</span>
              </div>
              
              {/* Progress bar */}
              <div className="feedback-gen-progress">
                <div className="progress-track">
                  <div className="progress-fill"></div>
                </div>
              </div>
              
              {/* Description */}
              <p className="feedback-gen-desc">
                Our AI is carefully reviewing your responses to provide personalized feedback
              </p>
              
              {/* Steps indicator */}
              <div className="feedback-gen-steps">
                <div className={`step ${feedbackProgress.includes('Saving interview') ? 'active' : feedbackProgress.includes('Analyzing') || feedbackProgress.includes('Complete') ? 'completed' : ''}`}>
                  <div className="step-icon">💾</div>
                  <span>Saving Data</span>
                </div>
                <div className="step-connector"></div>
                <div className={`step ${feedbackProgress.includes('Analyzing') ? 'active' : feedbackProgress.includes('Saving feedback') || feedbackProgress.includes('Complete') ? 'completed' : ''}`}>
                  <div className="step-icon">🔍</div>
                  <span>Analyzing</span>
                </div>
                <div className="step-connector"></div>
                <div className={`step ${feedbackProgress.includes('Saving feedback') ? 'active' : feedbackProgress.includes('Complete') ? 'completed' : ''}`}>
                  <div className="step-icon">📊</div>
                  <span>Generating Report</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pre-interview view
  if (!isCallActive && !isConnecting) {
    return (
      <div className="dashboard-container">
        <div className="journey-container">
          <div className="dashboard-card journey-card">
            <div className="interview-start">
              <div className="start-header">
                <h1 className="start-title">Ready to Begin Your AI Voice Interview</h1>
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
                      <p>AI Voice Call</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="interview-tips">
                <h3>Quick Tips</h3>
                <ul>
                  <li>🎧 Use headphones for the best experience</li>
                  <li>🎙️ Ensure your microphone is working properly</li>
                  <li>🔇 Find a quiet environment without background noise</li>
                  <li>💬 Speak clearly and at a moderate pace</li>
                  <li>⏸️ You can pause and resume if needed</li>
                  <li>🤔 Take your time to think before answering</li>
                </ul>
              </div>

              {error && (
                <div className="error-banner">
                  <span className="error-icon">⚠️</span>
                  <span className="error-text">{error}</span>
                </div>
              )}

              <div className="start-actions">
                <button 
                  onClick={() => router.push(`/dashboard/interview-setup/${sessionId}`)}
                  className="btn-secondary"
                >
                  Back to Setup
                </button>
                <button 
                  onClick={startCall}
                  className="btn-primary btn-large"
                  disabled={!vapi}
                >
                  🎙️ Start Voice Interview
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // During interview view
  return (
    <div className="dashboard-container">
      <div className="interview-call-container">
        <div className="dashboard-card interview-call-card">
          {/* Call Header */}
          <div className="call-header">
            <div className="call-info">
              <div className="call-status">
                <span className={`status-indicator ${isCallActive ? 'active' : 'connecting'}`}></span>
                <span className="status-text">
                  {isConnecting ? 'Connecting...' : isCallActive ? 'In Progress' : 'Ended'}
                </span>
              </div>
              <div className="call-duration">
                {formatDuration(callDuration)}
              </div>
            </div>
            <div className="call-meta">
              <span className="interview-type">{session.interviewType || 'Mixed'}</span>
              <span className="question-count">{questions.length} Questions</span>
            </div>
          </div>

          {/* Call Visualization */}
          <div className="call-visualization">
            <div className={`ai-avatar ${assistantIsSpeaking ? 'speaking' : ''}`}>
              <div className="avatar-circle">
                🤖
              </div>
              <div className="audio-wave">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className="wave-bar"
                    style={{ 
                      height: assistantIsSpeaking ? `${20 + Math.random() * 60}%` : '20%' 
                    }}
                  ></div>
                ))}
              </div>
              <p className="avatar-label">
                {assistantIsSpeaking ? 'AI is speaking...' : 'AI is listening...'}
              </p>
            </div>

            {/* Volume Level Indicator */}
            {!isMuted && isCallActive && (
              <div className="volume-indicator">
                <div className="volume-label">Your voice:</div>
                <div className="volume-bar-container">
                  <div 
                    className="volume-bar-fill" 
                    style={{ width: `${volumeLevel}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Speaker Cards */}
          <div className="speaker-cards-container">
            <div className="speaker-card">
              <div className={`speaker-avatar-wrapper ${assistantIsSpeaking ? 'speaking' : ''}`}>
                <div className="speaker-avatar ai-avatar-icon">
                  👩‍💼
                </div>
              </div>
              <p className="speaker-name">AI Recruiter</p>
            </div>

            <div className="speaker-card">
              <div className={`speaker-avatar-wrapper ${userIsSpeaking ? 'speaking' : ''}`}>
                <div className="speaker-avatar user-avatar-icon">
                  U
                </div>
              </div>
              <p className="speaker-name">User</p>
            </div>
          </div>

          {/* Call Controls */}
          <div className="call-controls">
            <button 
              onClick={toggleMute}
              className={`control-btn ${isMuted ? 'muted' : ''}`}
              disabled={!isCallActive || !vapi}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
              <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button 
              onClick={endCall}
              className="control-btn end-call"
            >
              📞
              <span className="control-label">End Interview</span>
            </button>
          </div>

          {error && (
            <div className="call-error">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
