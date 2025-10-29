"use client";

import { useState, useEffect, use } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { redirect, useRouter } from 'next/navigation';
import { Id } from '../../../../convex/_generated/dataModel';

const AI_MODELS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT (GPT-4)',
    description: 'Most versatile and balanced AI model for comprehensive interviews',
    icon: '🤖',
    strengths: ['Natural conversation', 'Follow-up questions', 'Detailed feedback']
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google\'s advanced AI with strong reasoning capabilities',
    icon: '💎',
    strengths: ['Technical analysis', 'Code evaluation', 'Multi-modal understanding']
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Specialized in technical and analytical questions',
    icon: '🔍',
    strengths: ['Technical depth', 'Problem solving', 'Logical reasoning']
  }
];

const INTERVIEW_TYPES = [
  {
    id: 'technical',
    name: 'Technical Interview',
    description: 'Focus on technical skills, coding, and problem-solving',
    icon: '💻',
    duration: [45, 60, 90]
  },
  {
    id: 'behavioral',
    name: 'Behavioral Interview', 
    description: 'Focus on soft skills, experience, and cultural fit',
    icon: '👥',
    duration: [30, 45, 60]
  },
  {
    id: 'mixed',
    name: 'Mixed Interview',
    description: 'Combination of technical and behavioral questions',
    icon: '🎯',
    duration: [60, 75, 90]
  },
  {
    id: 'hr',
    name: 'HR Interview',
    description: 'Focus on company fit, motivation, and general questions',
    icon: '🏢',
    duration: [20, 30, 45]
  }
];

const DIFFICULTY_LEVELS = [
  {
    id: 'beginner',
    name: 'Beginner',
    description: 'Entry-level questions suitable for new graduates',
    color: 'bg-green-100 text-green-700'
  },
  {
    id: 'intermediate',
    name: 'Intermediate', 
    description: 'Mid-level questions for experienced professionals',
    color: 'bg-yellow-100 text-yellow-700'
  },
  {
    id: 'advanced',
    name: 'Advanced',
    description: 'Senior-level questions for experienced candidates',
    color: 'bg-red-100 text-red-700'
  }
];

export default function InterviewConfigPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  // Unwrap the params Promise
  const { sessionId } = use(params);
  
  // Configuration state
  const [selectedModel, setSelectedModel] = useState('chatgpt');
  const [selectedType, setSelectedType] = useState('mixed');
  const [selectedDifficulty, setSelectedDifficulty] = useState('intermediate');
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [isLoading, setIsLoading] = useState(false);

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
    if (session && session.aiModel) {
      setSelectedModel(session.aiModel);
      setSelectedType(session.interviewType || 'mixed');
      setSelectedDifficulty(session.difficulty || 'intermediate');
      setSelectedDuration(session.interviewDuration || 60);
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

  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      await updateSession({
        sessionId: sessionId as Id<"interviewSessions">,
        updates: {
          aiModel: selectedModel,
          interviewType: selectedType,
          difficulty: selectedDifficulty,
          interviewDuration: selectedDuration,
          status: 'configured'
        }
      });

      // Redirect to interview preparation/setup page
      router.push(`/dashboard/interview-setup/${sessionId}`);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert('Failed to save configuration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTypeData = INTERVIEW_TYPES.find(type => type.id === selectedType);
  const availableDurations = selectedTypeData?.duration || [30, 45, 60];

  return (
    <div className="dashboard-container">
      <div className="journey-container">
        <div className="dashboard-card journey-card interview-config-card">
          {/* Header */}
          <div className="config-header">
            <h1 className="config-title">Configure Your Interview</h1>
            <p className="config-subtitle">
              Customize your interview experience based on your preferences and the job requirements
            </p>
          </div>

          {/* ATS Score Summary */}
          {session.atsScore && (
            <div className="ats-summary-banner">
              <div className="ats-score-display">
                <span className="ats-label">ATS Score:</span>
                <span className={`ats-score ${session.atsScore >= 80 ? 'high' : session.atsScore >= 60 ? 'medium' : 'low'}`}>
                  {session.atsScore}%
                </span>
              </div>
              <button 
                onClick={() => router.push(`/dashboard/ats-report/${sessionId}`)}
                className="view-report-btn"
              >
                View Full Report
              </button>
            </div>
          )}

          <div className="config-content">
            {/* AI Model Selection */}
            <div className="config-section">
              <h3 className="section-title">Choose AI Model</h3>
              <div className="model-grid">
                {AI_MODELS.map((model) => (
                  <div 
                    key={model.id}
                    className={`model-card ${selectedModel === model.id ? 'selected' : ''}`}
                    onClick={() => setSelectedModel(model.id)}
                  >
                    <div className="model-icon">{model.icon}</div>
                    <h4 className="model-name">{model.name}</h4>
                    <p className="model-description">{model.description}</p>
                    <div className="model-strengths">
                      {model.strengths.map((strength, index) => (
                        <span key={index} className="strength-tag">{strength}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interview Type Selection */}
            <div className="config-section">
              <h3 className="section-title">Interview Type</h3>
              <div className="type-grid">
                {INTERVIEW_TYPES.map((type) => (
                  <div 
                    key={type.id}
                    className={`type-card ${selectedType === type.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedType(type.id);
                      // Reset duration to first available option for this type
                      setSelectedDuration(type.duration[0]);
                    }}
                  >
                    <div className="type-icon">{type.icon}</div>
                    <h4 className="type-name">{type.name}</h4>
                    <p className="type-description">{type.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Difficulty Level */}
            <div className="config-section">
              <h3 className="section-title">Difficulty Level</h3>
              <div className="difficulty-options">
                {DIFFICULTY_LEVELS.map((level) => (
                  <div 
                    key={level.id}
                    className={`difficulty-option ${selectedDifficulty === level.id ? 'selected' : ''}`}
                    onClick={() => setSelectedDifficulty(level.id)}
                  >
                    <div className={`difficulty-badge ${level.color}`}>
                      {level.name}
                    </div>
                    <p className="difficulty-description">{level.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Duration Selection */}
            <div className="config-section">
              <h3 className="section-title">Interview Duration</h3>
              <div className="duration-options">
                {availableDurations.map((duration) => (
                  <button
                    key={duration}
                    className={`duration-btn ${selectedDuration === duration ? 'selected' : ''}`}
                    onClick={() => setSelectedDuration(duration)}
                  >
                    {duration} minutes
                  </button>
                ))}
              </div>
            </div>

            {/* Configuration Summary */}
            <div className="config-summary">
              <h3 className="section-title">Interview Summary</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">AI Model:</span>
                  <span className="summary-value">
                    {AI_MODELS.find(m => m.id === selectedModel)?.name}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Type:</span>
                  <span className="summary-value">
                    {INTERVIEW_TYPES.find(t => t.id === selectedType)?.name}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Difficulty:</span>
                  <span className="summary-value">
                    {DIFFICULTY_LEVELS.find(d => d.id === selectedDifficulty)?.name}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Duration:</span>
                  <span className="summary-value">{selectedDuration} minutes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="config-actions">
            <button 
              onClick={() => router.push(`/dashboard/ats-report/${sessionId}`)}
              className="btn-secondary"
            >
              Back to Report
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Saving...' : 'Start Interview Setup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}