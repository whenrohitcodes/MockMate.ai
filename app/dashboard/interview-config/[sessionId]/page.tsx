"use client";

import { use } from 'react';
import { useUser } from '@clerk/nextjs';
import { redirect, useRouter } from 'next/navigation';

export default function InterviewConfigPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  // Unwrap the params Promise
  const { sessionId } = use(params);

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

  return (
    <div className="dashboard-container">
      <div className="journey-container">
        <div className="dashboard-card journey-card">
          <div className="config-header" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <h1 className="config-title">Interview Configuration</h1>
            <p className="config-subtitle" style={{ marginTop: '1rem', color: '#6b7280' }}>
              This feature is coming soon...
            </p>
            <button 
              onClick={() => router.push(`/dashboard/ats-report/${sessionId}`)}
              className="btn-primary"
              style={{ marginTop: '2rem' }}
            >
              Back to ATS Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}