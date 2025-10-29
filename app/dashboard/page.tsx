"use client";

import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const [mounted, setMounted] = useState(false);

  // Get user data from Convex
  const convexUser = useQuery(api.users.getUserByClerkId, 
    user?.id ? { clerkId: user.id } : "skip"
  );

  // Get user's mock interviews
  const mockInterviews = useQuery(api.mockInterviews.getMockInterviewsByUser,
    convexUser?._id ? { userId: convexUser._id } : "skip"
  );

  // Get user progress
  const userProgress = useQuery(api.userProgress.getUserProgress,
    convexUser?._id ? { userId: convexUser._id } : "skip"
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle loading and authentication
  if (!mounted || !isLoaded) {
    return (
      <div className="dashboard-container flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    redirect('/sign-in');
    return null;
  }

  // Calculate stats
  const totalInterviews = mockInterviews?.length || 0;
  const completedInterviews = mockInterviews?.filter(interview => interview.isCompleted).length || 0;
  const averageRating = userProgress?.averageRating || 0;
  const recentInterviews = mockInterviews?.slice(0, 3) || [];

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        {/* Welcome Section */}
        <div className="dashboard-welcome">
          <h1 className="dashboard-title">
            Welcome back, {user.firstName || user.emailAddresses[0].emailAddress}!
          </h1>
          <p className="dashboard-subtitle">
            Optimize your resume for job applications with our ATS analysis tool.
          </p>
        </div>

        {/* Start Journey Card */}
        <div className="journey-card-container">
          <div className="dashboard-card start-journey-card">
            <div className="journey-card-content">
              <div className="journey-card-icon">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="journey-card-text">
                <h2 className="journey-card-title">Analyze Your Resume</h2>
                <p className="journey-card-description">
                  Upload your resume and job description to get a detailed ATS compatibility report and optimization suggestions.
                </p>
              </div>
              <button 
                onClick={() => window.location.href = '/dashboard/resume-upload'}
                className="btn-primary journey-card-button">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}