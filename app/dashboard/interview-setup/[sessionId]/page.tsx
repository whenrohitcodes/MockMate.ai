"use client";

import { useState, useEffect, use } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { redirect, useRouter } from 'next/navigation';
import { Id } from '../../../../convex/_generated/dataModel';

export default function InterviewSetupPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  
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

  useEffect(() => {
    if (session && session.status === 'configured') {
      generateInterviewQuestions();
    }
  }, [session]);

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

  const generateInterviewQuestions = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      setGenerationStep('Analyzing your resume and job description...');
      
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          resumeContent: session.resumeContent || '',
          jobDescriptionContent: session.jobDescriptionContent || '',
          interviewType: session.interviewType,
          difficulty: session.difficulty,
          duration: session.interviewDuration,
          aiModel: session.aiModel,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate questions');
      }

      setGenerationStep('Questions generated! Setting up VAPI interview...');
      
      const result = await response.json();
      
      // Initialize VAPI assistant
      setGenerationStep('Initializing AI voice assistant...');
      
      const vapiResponse = await fetch('/api/setup-vapi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          questions: result.questions,
          interviewConfig: {
            duration: session.interviewDuration,
            type: session.interviewType,
            difficulty: session.difficulty,
            aiModel: session.aiModel,
          },
        }),
      });

      if (!vapiResponse.ok) {
        throw new Error('Failed to setup VAPI assistant');
      }

      const vapiResult = await vapiResponse.json();
      
      // Update session with generated questions and VAPI data
      await updateSession({
        sessionId: sessionId as Id<"interviewSessions">,
        updates: {
          generatedQuestions: result.questions,
          vapiSessionId: vapiResult.assistantId,
          status: 'interview_ready'
        }
      });

      setGenerationStep('Ready to start interview!');
      
      // Redirect to interview page after a short delay
      setTimeout(() => {
        router.push(`/dashboard/interview/${sessionId}`);
      }, 1500);

    } catch (error) {
      console.error('Interview setup failed:', error);
      setError('Failed to setup interview. Please try again.');
      setIsGenerating(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    generateInterviewQuestions();
  };

  const getModelName = (model: string) => {
    switch (model) {
      case 'chatgpt': return 'ChatGPT (GPT-4)';
      case 'gemini': return 'Google Gemini';
      case 'deepseek': return 'DeepSeek';
      default: return model;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'technical': return 'Technical Interview';
      case 'behavioral': return 'Behavioral Interview';
      case 'mixed': return 'Mixed Interview';
      case 'hr': return 'HR Interview';
      default: return type;
    }
  };

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="journey-container">
          <div className="dashboard-card journey-card">
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <h2 className="error-title">Setup Failed</h2>
              <p className="error-message">{error}</p>
              <div className="error-actions">
                <button onClick={() => router.push('/dashboard')} className="btn-secondary">
                  Back to Dashboard
                </button>
                <button onClick={handleRetry} className="btn-primary">
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="journey-container">
        <div className="dashboard-card journey-card interview-setup-card">
          {/* Header */}
          <div className="setup-header">
            <h1 className="setup-title">Setting Up Your Interview</h1>
            <p className="setup-subtitle">
              We're preparing your personalized interview experience
            </p>
          </div>

          {/* Interview Configuration Summary */}
          <div className="config-summary-display">
            <h3 className="config-summary-title">Interview Configuration</h3>
            <div className="config-summary-grid">
              <div className="config-item">
                <span className="config-label">AI Model:</span>
                <span className="config-value">{getModelName(session.aiModel || 'chatgpt')}</span>
              </div>
              <div className="config-item">
                <span className="config-label">Type:</span>
                <span className="config-value">{getTypeName(session.interviewType || 'mixed')}</span>
              </div>
              <div className="config-item">
                <span className="config-label">Difficulty:</span>
                <span className="config-value">{session.difficulty || 'intermediate'}</span>
              </div>
              <div className="config-item">
                <span className="config-label">Duration:</span>
                <span className="config-value">{session.interviewDuration || 60} minutes</span>
              </div>
            </div>
          </div>

          {/* Setup Progress */}
          <div className="setup-progress">
            <div className="progress-container">
              <div className="progress-spinner">
                <div className="loading-spinner-large"></div>
              </div>
              <div className="progress-content">
                <h3 className="progress-title">
                  {isGenerating ? 'Preparing Interview...' : 'Interview Ready!'}
                </h3>
                <p className="progress-step">
                  {generationStep || 'Initializing setup...'}
                </p>
              </div>
            </div>

            <div className="setup-steps">
              <div className={`setup-step ${session.status !== 'configured' ? 'completed' : 'active'}`}>
                <div className="step-icon">
                  {session.status !== 'configured' ? '✓' : '⚡'}
                </div>
                <span className="step-text">Generating personalized questions</span>
              </div>
              <div className={`setup-step ${session.status === 'interview_ready' ? 'completed' : ''}`}>
                <div className="step-icon">
                  {session.status === 'interview_ready' ? '✓' : '○'}
                </div>
                <span className="step-text">Setting up AI voice assistant</span>
              </div>
              <div className="setup-step">
                <div className="step-icon">○</div>
                <span className="step-text">Preparing interview environment</span>
              </div>
            </div>
          </div>

          {/* What to Expect */}
          <div className="interview-preview">
            <h3 className="preview-title">What to Expect</h3>
            <div className="preview-grid">
              <div className="preview-item">
                <div className="preview-icon">🎙️</div>
                <h4 className="preview-item-title">Voice Interview</h4>
                <p className="preview-item-description">
                  Speak naturally with our AI interviewer using your microphone
                </p>
              </div>
              <div className="preview-item">
                <div className="preview-icon">🤖</div>
                <h4 className="preview-item-title">AI-Powered Questions</h4>
                <p className="preview-item-description">
                  Personalized questions based on your resume and the job description
                </p>
              </div>
              <div className="preview-item">
                <div className="preview-icon">📊</div>
                <h4 className="preview-item-title">Real-time Feedback</h4>
                <p className="preview-item-description">
                  Get detailed feedback and scoring after the interview
                </p>
              </div>
              <div className="preview-item">
                <div className="preview-icon">⏱️</div>
                <h4 className="preview-item-title">Timed Session</h4>
                <p className="preview-item-description">
                  {session.interviewDuration || 60}-minute structured interview session
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {session.status === 'interview_ready' && (
            <div className="setup-actions">
              <button 
                onClick={() => router.push(`/dashboard/interview-config/${sessionId}`)}
                className="btn-secondary"
              >
                Back to Configuration
              </button>
              <button 
                onClick={() => router.push(`/dashboard/interview/${sessionId}`)}
                className="btn-primary"
              >
                Start Interview Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}