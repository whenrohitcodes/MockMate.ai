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

  // Get questions
  const questions = session?.generatedQuestions || [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [conversationHistory]);

  // Handle call end
  const handleCallEnd = useCallback(async () => {
    try {
      await updateSession({
        sessionId: sessionId as Id<"interviewSessions">,
        updates: {
          status: 'completed',
          completedAt: Date.now()
        }
      });
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (error) {
      console.error('Failed to update session:', error);
      // Still redirect even if update fails
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    }
  }, [sessionId, updateSession, router]);

  // Initialize VAPI client
  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!publicKey) {
      setError('VAPI is not configured. Please contact support.');
      return;
    }

    const vapiClient = new Vapi(publicKey);
    setVapi(vapiClient);

    // Set up event listeners
    vapiClient.on('call-start', () => {
      console.log('Call started');
      setIsCallActive(true);
      setIsConnecting(false);
      setConversationHistory([{
        role: 'system',
        message: 'Call connected. The AI interviewer will begin shortly.',
        timestamp: new Date(),
        isComplete: true
      }]);
    });

    vapiClient.on('call-end', () => {
      console.log('Call ended');
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
      handleCallEnd();
    });

    vapiClient.on('speech-start', () => {
      console.log('Assistant started speaking');
      setAssistantIsSpeaking(true);
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
    });

    vapiClient.on('error', (error: any) => {
      console.error('VAPI error:', error);
      setError(`Call error: ${error.message || 'Unknown error'}`);
      setIsCallActive(false);
      setIsConnecting(false);
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

  const startCall = async () => {
    if (!vapi) {
      setError('VAPI is not initialized properly. Please try refreshing the page.');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      console.log('Starting call with inline assistant configuration');

      // Update session status
      await updateSession({
        sessionId: sessionId as Id<"interviewSessions">,
        updates: {
          status: 'in_progress'
        }
      });

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

      // Start the call with inline assistant config (client-side approach)
      await vapi.start({
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: interviewScript
            }
          ]
        },
        voice: {
          provider: "11labs",
          voiceId: "burt"
        },
        name: "Interview Assistant",
        firstMessage: `Hello! Welcome to your ${session.interviewType || 'mixed'} interview. I'm your AI interview assistant. Are you ready to get started with the first question?`,
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en"
        }
      });
      
    } catch (error) {
      console.error('Failed to start call:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      setError(`Failed to start interview: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  const endCall = async () => {
    if (vapi && isCallActive) {
      vapi.stop();
      // The call-end event will handle the rest
    }
  };

  const toggleMute = () => {
    if (vapi && isCallActive) {
      const newMuteState = !isMuted;
      vapi.setMuted(newMuteState);
      setIsMuted(newMuteState);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
              disabled={!isCallActive}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
              <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button 
              onClick={endCall}
              className="control-btn end-call"
              disabled={!isCallActive && !isConnecting}
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
