"use client";

import { use } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { redirect, useRouter } from 'next/navigation';
import { Id } from '../../../../convex/_generated/dataModel';

export default function InterviewResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  // Unwrap the params Promise
  const { sessionId } = use(params);

  // Get session data
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

  return (
    <div className="dashboard-container">
      <div className="journey-container">
        <div className="dashboard-card journey-card">
          <div className="results-header">
            <h1 className="results-title">Interview Complete! 🎉</h1>
            <p className="results-subtitle">
              Thank you for completing your mock interview session
            </p>
          </div>

          <div className="results-summary">
            <div className="summary-stats">
              <div className="stat-item">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                  <h3>Duration</h3>
                  <p>{session.interviewDuration || 60} minutes</p>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">❓</div>
                <div className="stat-content">
                  <h3>Questions</h3>
                  <p>{session.generatedQuestions?.length || 0} answered</p>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                  <h3>Type</h3>
                  <p>{session.interviewType || 'Mixed'}</p>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <h3>Difficulty</h3>
                  <p>{session.difficulty || 'Intermediate'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="feedback-section">
            <h2>What's Next?</h2>
            <div className="next-steps">
              <div className="step-item">
                <div className="step-icon">📝</div>
                <div className="step-content">
                  <h3>Review Your Responses</h3>
                  <p>Analyze your answers and identify areas for improvement</p>
                </div>
              </div>
              <div className="step-item">
                <div className="step-icon">🔄</div>
                <div className="step-content">
                  <h3>Practice More</h3>
                  <p>Take additional mock interviews to build confidence</p>
                </div>
              </div>
              <div className="step-item">
                <div className="step-icon">🎯</div>
                <div className="step-content">
                  <h3>Apply Your Skills</h3>
                  <p>Use your improved interview skills in real interviews</p>
                </div>
              </div>
            </div>
          </div>

          <div className="completion-message">
            <div className="message-content">
              <h3>Great Job! 👏</h3>
              <p>
                You've successfully completed your mock interview session. 
                The experience you gained here will help you perform better in real interviews.
              </p>
              <p>
                <strong>Pro Tip:</strong> Regular practice is key to interview success. 
                Consider doing mock interviews regularly to maintain your skills.
              </p>
            </div>
          </div>

          <div className="results-actions">
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
    </div>
  );
}