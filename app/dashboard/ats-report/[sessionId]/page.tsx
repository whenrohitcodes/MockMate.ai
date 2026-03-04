"use client";

import { useState, useEffect, use } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { redirect, useRouter } from 'next/navigation';
import { Id } from '../../../../convex/_generated/dataModel';

interface ATSReport {
  overallScore: number;
  matchPercentage: number;
  keywordMatches: {
    found: string[];
    missing: string[];
  };
  sections: {
    skills: { score: number; feedback: string; suggestions: string[] };
    experience: { score: number; feedback: string; suggestions: string[] };
    education: { score: number; feedback: string; suggestions: string[] };
    formatting: { score: number; feedback: string; suggestions: string[] };
  };
  strengths: string[];
  improvementAreas: string[];
  recommendations: string[];
  estimatedATSCompatibility: string;
  summary: string;
}

export default function ATSReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [atsReport, setATSReport] = useState<ATSReport | null>(null);
  
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
    if (session && session.status === 'ats_processing') {
      generateATSReport();
    } else if (session && session.atsReport) {
      try {
        const parsed = JSON.parse(session.atsReport);
        // Check if this is a fallback report - if so, auto-regenerate
        if (parsed.summary?.includes('Fallback') || parsed.summary?.includes('fallback') || parsed.summary?.includes('model request failed')) {
          // Auto-regenerate instead of showing fallback
          generateATSReport();
        } else {
          setATSReport(parsed);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error parsing stored ATS report:', error);
        generateATSReport(); // Try to regenerate on parse error
      }
    } else if (session) {
      // No report yet, auto-generate
      generateATSReport();
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

  const generateATSReport = async () => {
    if (!session) return;

    try {
      setIsLoading(true);
      setError(null);

      // Debug logging
      console.log('Session data:', {
        resumeContent: session.resumeContent ? 'Present' : 'Missing',
        jobDescriptionContent: session.jobDescriptionContent ? 'Present' : 'Missing',
        resumeFileUrl: session.resumeFileUrl ? 'Present' : 'Missing',
        jobDescriptionFileUrl: session.jobDescriptionFileUrl ? 'Present' : 'Missing',
        resumeContentLength: session.resumeContent?.length || 0,
        jobDescriptionContentLength: session.jobDescriptionContent?.length || 0
      });

      // Check if we have text content or file URLs
      const hasResumeContent = session.resumeContent && session.resumeContent.trim().length > 0;
      const hasJobDescriptionContent = session.jobDescriptionContent && session.jobDescriptionContent.trim().length > 0;
      const hasResumeFile = session.resumeFileUrl && session.resumeFileUrl.trim().length > 0;
      const hasJobDescriptionFile = session.jobDescriptionFileUrl && session.jobDescriptionFileUrl.trim().length > 0;

      if ((!hasResumeContent && !hasResumeFile) || (!hasJobDescriptionContent && !hasJobDescriptionFile)) {
        throw new Error(`Missing required data: Resume: ${(hasResumeContent || hasResumeFile) ? 'Present' : 'Missing'}, Job Description: ${(hasJobDescriptionContent || hasJobDescriptionFile) ? 'Present' : 'Missing'}`);
      }

      // Send text content AND file URLs to API (API will use file URLs if text is empty)
      const requestBody = {
        resumeText: session.resumeContent || '',
        jobDescriptionText: session.jobDescriptionContent || '',
        resumeFileUrl: session.resumeFileUrl || '',
        jobDescriptionFileUrl: session.jobDescriptionFileUrl || ''
      };

      console.log('Request body:', {
        resumeTextLength: requestBody.resumeText?.length || 0,
        jobDescriptionTextLength: requestBody.jobDescriptionText?.length || 0,
        hasResumeFileUrl: !!requestBody.resumeFileUrl,
        hasJobDescriptionFileUrl: !!requestBody.jobDescriptionFileUrl
      });

      const response = await fetch('/api/generate-ats-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json().catch(() => ({ success: false }));

      if (!response.ok || !result.success) {
        console.error('API Error Response:', result);
        throw new Error(`Failed to generate ATS report: ${result.error || response.statusText}`);
      }
      
      // Update session with ATS report
      await updateSession({
        sessionId: sessionId as Id<"interviewSessions">,
        updates: {
          atsReport: JSON.stringify(result.atsReport),
          atsScore: result.atsReport.overallScore,
          parsedResumeData: JSON.stringify(result.parsedResumeData),
          status: 'ats_ready'
        }
      });

      setATSReport(result.atsReport);
    } catch (error) {
      console.error('ATS report generation failed:', error);
      setError('Failed to generate ATS report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="journey-container">
          <div className="dashboard-card journey-card">
            <div className="ats-processing">
              <div className="processing-icon">
                <div className="loading-spinner-large"></div>
              </div>
              <h2 className="processing-title">Analyzing Your Resume</h2>
              <p className="processing-description">
                We're generating your ATS compatibility report by analyzing your resume against the job description...
              </p>
              <div className="processing-steps">
                <div className="processing-step">✓ Resume parsed</div>
                <div className="processing-step">✓ Job requirements extracted</div>
                <div className="processing-step">⚡ Generating ATS report...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="journey-container">
          <div className="dashboard-card journey-card">
            <div className="error-container">
              <h2 className="error-title">Error Generating Report</h2>
              <p className="error-message">{error}</p>
              <button 
                onClick={generateATSReport}
                className="btn-primary"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!atsReport) {
    return (
      <div className="dashboard-container">
        <div className="journey-container">
          <div className="dashboard-card journey-card">
            <div className="error-container">
              <h2 className="error-title">Generate ATS Report</h2>
              <p className="error-message">Click below to analyze your resume against the job description.</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="btn-secondary"
                >
                  Back to Dashboard
                </button>
                <button 
                  onClick={generateATSReport}
                  className="btn-primary"
                >
                  Generate Report
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
        <div className="dashboard-card journey-card ats-report-card">
          {/* Header */}
          <div className="ats-report-header">
            <h1 className="ats-report-title">ATS Compatibility Report</h1>
            <p className="ats-report-subtitle">
              Analysis of your resume against the job requirements
            </p>
          </div>

          {/* Overall Score */}
          <div className="ats-overall-score">
            <div className="score-circle">
              <div className={`score-value ${getScoreColor(atsReport.overallScore)}`}>
                {atsReport.overallScore}%
              </div>
              <div className="score-label">Overall Score</div>
            </div>
            <div className="match-percentage">
              <div className="match-label">Match Percentage</div>
              <div className={`match-value ${getScoreColor(atsReport.matchPercentage)}`}>
                {atsReport.matchPercentage}%
              </div>
            </div>
            <div className="compatibility-badge">
              <span className={`compatibility-level ${atsReport.estimatedATSCompatibility.toLowerCase()}`}>
                {atsReport.estimatedATSCompatibility} Compatibility
              </span>
            </div>
          </div>

          {/* Summary */}
          <div className="ats-summary">
            <h3 className="section-title">Summary</h3>
            <p className="summary-text">{atsReport.summary}</p>
          </div>

          {/* Section Scores */}
          <div className="ats-sections">
            <h3 className="section-title">Section Analysis</h3>
            <div className="sections-grid">
              {Object.entries(atsReport.sections).map(([sectionName, sectionData]) => (
                <div key={sectionName} className="section-card">
                  <div className="section-header">
                    <h4 className="section-name">{sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}</h4>
                    <div className={`section-score ${getScoreBgColor(sectionData.score)} ${getScoreColor(sectionData.score)}`}>
                      {sectionData.score}%
                    </div>
                  </div>
                  <p className="section-feedback">{sectionData.feedback}</p>
                  {sectionData.suggestions.length > 0 && (
                    <div className="section-suggestions">
                      <strong>Suggestions:</strong>
                      <ul className="suggestions-list">
                        {sectionData.suggestions.map((suggestion, index) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div className="ats-keywords">
            <div className="keywords-section">
              <h4 className="keywords-title">Found Keywords</h4>
              <div className="keywords-list found">
                {atsReport.keywordMatches.found.map((keyword, index) => (
                  <span key={index} className="keyword-tag found">{keyword}</span>
                ))}
              </div>
            </div>
            <div className="keywords-section">
              <h4 className="keywords-title">Missing Keywords</h4>
              <div className="keywords-list missing">
                {atsReport.keywordMatches.missing.map((keyword, index) => (
                  <span key={index} className="keyword-tag missing">{keyword}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Strengths and Areas for Improvement */}
          <div className="ats-insights">
            <div className="insights-section">
              <h4 className="insights-title">Strengths</h4>
              <ul className="insights-list strengths">
                {atsReport.strengths.map((strength, index) => (
                  <li key={index}>{strength}</li>
                ))}
              </ul>
            </div>
            <div className="insights-section">
              <h4 className="insights-title">Areas for Improvement</h4>
              <ul className="insights-list improvements">
                {atsReport.improvementAreas.map((area, index) => (
                  <li key={index}>{area}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommendations */}
          <div className="ats-recommendations">
            <h3 className="section-title">Recommendations</h3>
            <ul className="recommendations-list">
              {atsReport.recommendations.map((recommendation, index) => (
                <li key={index}>{recommendation}</li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="ats-actions">
            <button 
              onClick={() => router.push('/dashboard')}
              className="btn-secondary"
            >
              Back to Dashboard
            </button>
            <button 
              onClick={() => router.push(`/dashboard/interview-config/${sessionId}`)}
              className="btn-primary"
            >
              Configure Interview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}