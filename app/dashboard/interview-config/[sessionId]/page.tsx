"use client";

import { useState, use } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { redirect, useRouter } from 'next/navigation';
import { Id } from '../../../../convex/_generated/dataModel';

export default function InterviewConfigPage({ params }: { params: Promise<{ sessionId: string }> }) {
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

  // Configuration state
  const [config, setConfig] = useState({
    aiModel: 'chatgpt',
    interviewType: 'mixed',
    difficulty: 'intermediate',
    duration: 30
  });

  const [isSaving, setIsSaving] = useState(false);

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

  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    try {
      await updateSession({
        sessionId: sessionId as Id<"interviewSessions">,
        updates: {
          aiModel: config.aiModel,
          interviewType: config.interviewType,
          difficulty: config.difficulty,
          interviewDuration: config.duration,
          status: 'configured'
        }
      });

      // Navigate to interview setup
      router.push(`/dashboard/interview-setup/${sessionId}`);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert('Failed to save configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="journey-container">
        <div className="dashboard-card journey-card">
          {/* Header */}
          <div className="config-header">
            <h1 className="config-title">Configure Your Interview</h1>
            <p className="config-subtitle">
              Customize your interview experience based on your preferences
            </p>
          </div>

          {/* Configuration Form */}
          <div className="config-form">
            {/* AI Model Selection */}
            <div className="config-section">
              <h3 className="config-section-title">AI Model</h3>
              <p className="config-section-description">
                Choose the AI model that will conduct your interview
              </p>
              <div className="config-options">
                <div 
                  className={`config-option ${config.aiModel === 'chatgpt' ? 'selected' : ''}`}
                  onClick={() => setConfig({...config, aiModel: 'chatgpt'})}
                >
                  <div className="option-header">
                    <span className="option-icon">🤖</span>
                    <span className="option-name">ChatGPT (GPT-4)</span>
                  </div>
                  <p className="option-description">Most reliable and conversational</p>
                </div>
                <div 
                  className={`config-option ${config.aiModel === 'gemini' ? 'selected' : ''}`}
                  onClick={() => setConfig({...config, aiModel: 'gemini'})}
                >
                  <div className="option-header">
                    <span className="option-icon">✨</span>
                    <span className="option-name">Google Gemini</span>
                  </div>
                  <p className="option-description">Fast and efficient responses</p>
                </div>
                <div 
                  className={`config-option ${config.aiModel === 'deepseek' ? 'selected' : ''}`}
                  onClick={() => setConfig({...config, aiModel: 'deepseek'})}
                >
                  <div className="option-header">
                    <span className="option-icon">🔍</span>
                    <span className="option-name">DeepSeek</span>
                  </div>
                  <p className="option-description">Technical and analytical</p>
                </div>
              </div>
            </div>

            {/* Interview Type */}
            <div className="config-section">
              <h3 className="config-section-title">Interview Type</h3>
              <p className="config-section-description">
                Select the type of interview you want to practice
              </p>
              <div className="config-options">
                <div 
                  className={`config-option ${config.interviewType === 'technical' ? 'selected' : ''}`}
                  onClick={() => setConfig({...config, interviewType: 'technical'})}
                >
                  <div className="option-header">
                    <span className="option-icon">💻</span>
                    <span className="option-name">Technical</span>
                  </div>
                  <p className="option-description">Focus on technical skills and problem-solving</p>
                </div>
                <div 
                  className={`config-option ${config.interviewType === 'behavioral' ? 'selected' : ''}`}
                  onClick={() => setConfig({...config, interviewType: 'behavioral'})}
                >
                  <div className="option-header">
                    <span className="option-icon">👥</span>
                    <span className="option-name">Behavioral</span>
                  </div>
                  <p className="option-description">Focus on past experiences and soft skills</p>
                </div>
                <div 
                  className={`config-option ${config.interviewType === 'mixed' ? 'selected' : ''}`}
                  onClick={() => setConfig({...config, interviewType: 'mixed'})}
                >
                  <div className="option-header">
                    <span className="option-icon">🎯</span>
                    <span className="option-name">Mixed</span>
                  </div>
                  <p className="option-description">Combination of technical and behavioral</p>
                </div>
                <div 
                  className={`config-option ${config.interviewType === 'hr' ? 'selected' : ''}`}
                  onClick={() => setConfig({...config, interviewType: 'hr'})}
                >
                  <div className="option-header">
                    <span className="option-icon">📋</span>
                    <span className="option-name">HR Round</span>
                  </div>
                  <p className="option-description">Focus on cultural fit and career goals</p>
                </div>
              </div>
            </div>

            {/* Difficulty Level */}
            <div className="config-section">
              <h3 className="config-section-title">Difficulty Level</h3>
              <p className="config-section-description">
                Choose the difficulty level that matches your experience
              </p>
              <div className="config-options">
                <div 
                  className={`config-option ${config.difficulty === 'beginner' ? 'selected' : ''}`}
                  onClick={() => setConfig({...config, difficulty: 'beginner'})}
                >
                  <div className="option-header">
                    <span className="option-icon">🌱</span>
                    <span className="option-name">Beginner</span>
                  </div>
                  <p className="option-description">Entry-level questions, 0-2 years experience</p>
                </div>
                <div 
                  className={`config-option ${config.difficulty === 'intermediate' ? 'selected' : ''}`}
                  onClick={() => setConfig({...config, difficulty: 'intermediate'})}
                >
                  <div className="option-header">
                    <span className="option-icon">📈</span>
                    <span className="option-name">Intermediate</span>
                  </div>
                  <p className="option-description">Mid-level questions, 2-5 years experience</p>
                </div>
                <div 
                  className={`config-option ${config.difficulty === 'advanced' ? 'selected' : ''}`}
                  onClick={() => setConfig({...config, difficulty: 'advanced'})}
                >
                  <div className="option-header">
                    <span className="option-icon">🚀</span>
                    <span className="option-name">Advanced</span>
                  </div>
                  <p className="option-description">Senior-level questions, 5+ years experience</p>
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="config-section">
              <h3 className="config-section-title">Interview Duration</h3>
              <p className="config-section-description">
                Select how long you want the interview to last
              </p>
              <div className="duration-selector">
                <input
                  type="range"
                  min="15"
                  max="60"
                  step="15"
                  value={config.duration}
                  onChange={(e) => setConfig({...config, duration: parseInt(e.target.value)})}
                  className="duration-slider"
                />
                <div className="duration-labels">
                  <span className="duration-value">{config.duration} minutes</span>
                  <span className="duration-hint">
                    ~{Math.ceil(config.duration / 5)} questions
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="config-actions">
            <button 
              onClick={() => router.push(`/dashboard/ats-report/${sessionId}`)}
              className="btn-secondary"
              disabled={isSaving}
            >
              Back to ATS Report
            </button>
            <button 
              onClick={handleSaveAndContinue}
              className="btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}