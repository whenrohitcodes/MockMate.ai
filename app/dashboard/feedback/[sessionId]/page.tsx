"use client";

import { use } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { redirect, useRouter } from 'next/navigation';
import { Id } from '../../../../convex/_generated/dataModel';
import './feedback.css';

interface DetailedFeedback {
  score: number;
  feedback: string;
  suggestions: string[];
}

interface QuestionAnalysis {
  question: string;
  responseQuality: string;
  feedback: string;
  betterApproach: string;
}

interface Recommendation {
  priority: string;
  area: string;
  recommendation: string;
  resources: string[];
}

interface FeedbackData {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  detailedFeedback: {
    technicalKnowledge?: DetailedFeedback;
    communication?: DetailedFeedback;
    problemSolving?: DetailedFeedback;
    confidence?: DetailedFeedback;
    structuredThinking?: DetailedFeedback;
  };
  questionAnalysis: QuestionAnalysis[];
  recommendations: Recommendation[];
  interviewTips: string[];
  overallImpression: string;
}

export default function FeedbackPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { sessionId } = use(params);

  const session = useQuery(api.interviewSessions.getSessionById, 
    sessionId ? { sessionId: sessionId as Id<"interviewSessions"> } : "skip"
  );

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

  // Parse feedback data
  let feedback: FeedbackData | null = null;
  try {
    if (session.feedbackData) {
      feedback = JSON.parse(session.feedbackData);
    }
  } catch (e) {
    console.error('Failed to parse feedback data:', e);
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority.toLowerCase()) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getQualityColor = (quality: string): string => {
    switch (quality.toLowerCase()) {
      case 'excellent': return '#10b981';
      case 'good': return '#3b82f6';
      case 'fair': return '#f59e0b';
      default: return '#ef4444';
    }
  };

  return (
    <div className="dashboard-container">
      <div className="feedback-container">
        {/* Header */}
        <div className="feedback-header">
          <div className="header-content">
            <button onClick={() => router.push('/dashboard')} className="back-button">
              ← Back to Dashboard
            </button>
            <h1 className="feedback-page-title">Interview Feedback</h1>
            <p className="feedback-page-subtitle">
              {session.interviewType || 'Mixed'} Interview • {session.difficulty || 'Intermediate'} Level
            </p>
          </div>
        </div>

        {/* Main Scores Card */}
        <div className="dashboard-card scores-card">
          <div className="overall-score-section">
            <div 
              className="overall-score-circle"
              style={{ borderColor: getScoreColor(session.overallScore || 0) }}
            >
              <span className="score-number">{session.overallScore || 0}</span>
              <span className="score-label">{getScoreLabel(session.overallScore || 0)}</span>
            </div>
            <div className="overall-score-info">
              <h2>Overall Performance</h2>
              <p>{feedback?.summary || 'Your interview has been analyzed.'}</p>
            </div>
          </div>

          <div className="score-breakdown">
            <div className="score-item">
              <div className="score-item-header">
                <span className="score-item-icon">💻</span>
                <span className="score-item-label">Technical</span>
              </div>
              <div className="score-bar-container">
                <div 
                  className="score-bar" 
                  style={{ 
                    width: `${session.technicalScore || 0}%`,
                    backgroundColor: getScoreColor(session.technicalScore || 0)
                  }}
                ></div>
              </div>
              <span className="score-value">{session.technicalScore || 0}%</span>
            </div>

            <div className="score-item">
              <div className="score-item-header">
                <span className="score-item-icon">💬</span>
                <span className="score-item-label">Communication</span>
              </div>
              <div className="score-bar-container">
                <div 
                  className="score-bar" 
                  style={{ 
                    width: `${session.communicationScore || 0}%`,
                    backgroundColor: getScoreColor(session.communicationScore || 0)
                  }}
                ></div>
              </div>
              <span className="score-value">{session.communicationScore || 0}%</span>
            </div>

            <div className="score-item">
              <div className="score-item-header">
                <span className="score-item-icon">💪</span>
                <span className="score-item-label">Confidence</span>
              </div>
              <div className="score-bar-container">
                <div 
                  className="score-bar" 
                  style={{ 
                    width: `${session.confidenceScore || 0}%`,
                    backgroundColor: getScoreColor(session.confidenceScore || 0)
                  }}
                ></div>
              </div>
              <span className="score-value">{session.confidenceScore || 0}%</span>
            </div>
          </div>
        </div>

        {/* Strengths and Improvements */}
        <div className="feedback-grid">
          <div className="dashboard-card strengths-card">
            <h3 className="card-title">
              <span className="title-icon">✨</span>
              Your Strengths
            </h3>
            <ul className="feedback-list strengths-list">
              {(session.strengths || feedback?.strengths || []).map((strength, index) => (
                <li key={index} className="feedback-item strength-item">
                  <span className="item-icon">✓</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>

          <div className="dashboard-card improvements-card">
            <h3 className="card-title">
              <span className="title-icon">🎯</span>
              Areas for Improvement
            </h3>
            <ul className="feedback-list improvements-list">
              {(session.improvementAreas || feedback?.areasForImprovement || []).map((area, index) => (
                <li key={index} className="feedback-item improvement-item">
                  <span className="item-icon">→</span>
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Detailed Feedback */}
        {feedback?.detailedFeedback && Object.keys(feedback.detailedFeedback).length > 0 && (
          <div className="dashboard-card detailed-feedback-card">
            <h3 className="card-title">
              <span className="title-icon">📊</span>
              Detailed Analysis
            </h3>
            <div className="detailed-feedback-grid">
              {feedback.detailedFeedback.technicalKnowledge && (
                <div className="detailed-item">
                  <div className="detailed-header">
                    <span className="detailed-icon">💻</span>
                    <span className="detailed-label">Technical Knowledge</span>
                    <span 
                      className="detailed-score"
                      style={{ color: getScoreColor(feedback.detailedFeedback.technicalKnowledge.score) }}
                    >
                      {feedback.detailedFeedback.technicalKnowledge.score}%
                    </span>
                  </div>
                  <p className="detailed-text">{feedback.detailedFeedback.technicalKnowledge.feedback}</p>
                  {feedback.detailedFeedback.technicalKnowledge.suggestions?.length > 0 && (
                    <ul className="suggestions-list">
                      {feedback.detailedFeedback.technicalKnowledge.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {feedback.detailedFeedback.communication && (
                <div className="detailed-item">
                  <div className="detailed-header">
                    <span className="detailed-icon">💬</span>
                    <span className="detailed-label">Communication</span>
                    <span 
                      className="detailed-score"
                      style={{ color: getScoreColor(feedback.detailedFeedback.communication.score) }}
                    >
                      {feedback.detailedFeedback.communication.score}%
                    </span>
                  </div>
                  <p className="detailed-text">{feedback.detailedFeedback.communication.feedback}</p>
                  {feedback.detailedFeedback.communication.suggestions?.length > 0 && (
                    <ul className="suggestions-list">
                      {feedback.detailedFeedback.communication.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {feedback.detailedFeedback.problemSolving && (
                <div className="detailed-item">
                  <div className="detailed-header">
                    <span className="detailed-icon">🧩</span>
                    <span className="detailed-label">Problem Solving</span>
                    <span 
                      className="detailed-score"
                      style={{ color: getScoreColor(feedback.detailedFeedback.problemSolving.score) }}
                    >
                      {feedback.detailedFeedback.problemSolving.score}%
                    </span>
                  </div>
                  <p className="detailed-text">{feedback.detailedFeedback.problemSolving.feedback}</p>
                  {feedback.detailedFeedback.problemSolving.suggestions?.length > 0 && (
                    <ul className="suggestions-list">
                      {feedback.detailedFeedback.problemSolving.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {feedback.detailedFeedback.confidence && (
                <div className="detailed-item">
                  <div className="detailed-header">
                    <span className="detailed-icon">💪</span>
                    <span className="detailed-label">Confidence</span>
                    <span 
                      className="detailed-score"
                      style={{ color: getScoreColor(feedback.detailedFeedback.confidence.score) }}
                    >
                      {feedback.detailedFeedback.confidence.score}%
                    </span>
                  </div>
                  <p className="detailed-text">{feedback.detailedFeedback.confidence.feedback}</p>
                  {feedback.detailedFeedback.confidence.suggestions?.length > 0 && (
                    <ul className="suggestions-list">
                      {feedback.detailedFeedback.confidence.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {feedback.detailedFeedback.structuredThinking && (
                <div className="detailed-item">
                  <div className="detailed-header">
                    <span className="detailed-icon">🧠</span>
                    <span className="detailed-label">Structured Thinking</span>
                    <span 
                      className="detailed-score"
                      style={{ color: getScoreColor(feedback.detailedFeedback.structuredThinking.score) }}
                    >
                      {feedback.detailedFeedback.structuredThinking.score}%
                    </span>
                  </div>
                  <p className="detailed-text">{feedback.detailedFeedback.structuredThinking.feedback}</p>
                  {feedback.detailedFeedback.structuredThinking.suggestions?.length > 0 && (
                    <ul className="suggestions-list">
                      {feedback.detailedFeedback.structuredThinking.suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Question Analysis */}
        {feedback?.questionAnalysis && feedback.questionAnalysis.length > 0 && (
          <div className="dashboard-card questions-card">
            <h3 className="card-title">
              <span className="title-icon">❓</span>
              Question-by-Question Analysis
            </h3>
            <div className="questions-list">
              {feedback.questionAnalysis.map((qa, index) => (
                <div key={index} className="question-item">
                  <div className="question-header">
                    <span className="question-number">Q{index + 1}</span>
                    <span className="question-text">{qa.question}</span>
                    <span 
                      className="response-quality"
                      style={{ backgroundColor: getQualityColor(qa.responseQuality) }}
                    >
                      {qa.responseQuality}
                    </span>
                  </div>
                  <div className="question-feedback">
                    <p><strong>Feedback:</strong> {qa.feedback}</p>
                    {qa.betterApproach && (
                      <p className="better-approach">
                        <strong>💡 Better Approach:</strong> {qa.betterApproach}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {feedback?.recommendations && feedback.recommendations.length > 0 && (
          <div className="dashboard-card recommendations-card">
            <h3 className="card-title">
              <span className="title-icon">📋</span>
              Personalized Recommendations
            </h3>
            <div className="recommendations-list">
              {feedback.recommendations.map((rec, index) => (
                <div key={index} className="recommendation-item">
                  <div className="recommendation-header">
                    <span 
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(rec.priority) }}
                    >
                      {rec.priority} priority
                    </span>
                    <span className="recommendation-area">{rec.area}</span>
                  </div>
                  <p className="recommendation-text">{rec.recommendation}</p>
                  {rec.resources && rec.resources.length > 0 && (
                    <div className="resources">
                      <span className="resources-label">📚 Resources:</span>
                      <ul>
                        {rec.resources.map((resource, i) => (
                          <li key={i}>{resource}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interview Tips */}
        {feedback?.interviewTips && feedback.interviewTips.length > 0 && (
          <div className="dashboard-card tips-card">
            <h3 className="card-title">
              <span className="title-icon">💡</span>
              Quick Tips for Next Time
            </h3>
            <ul className="tips-list">
              {feedback.interviewTips.map((tip, index) => (
                <li key={index} className="tip-item">
                  <span className="tip-icon">💡</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Overall Impression */}
        {feedback?.overallImpression && (
          <div className="dashboard-card impression-card">
            <h3 className="card-title">
              <span className="title-icon">📝</span>
              Overall Impression
            </h3>
            <p className="impression-text">{feedback.overallImpression}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="feedback-actions">
          <button 
            onClick={() => router.push('/dashboard')}
            className="btn-secondary"
          >
            Back to Dashboard
          </button>
          <button 
            onClick={() => router.push('/dashboard/resume-upload')}
            className="btn-primary"
          >
            Start New Interview
          </button>
        </div>
      </div>
    </div>
  );
}
