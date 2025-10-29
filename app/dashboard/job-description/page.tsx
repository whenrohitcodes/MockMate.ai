"use client";

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { redirect, useRouter } from 'next/navigation';

interface FileUploadState {
  file: File | null;
  text: string;
  uploading: boolean;
  uploadedUrl?: string;
}

interface ResumeData {
  file: {
    name: string;
    size: number;
    type: string;
  } | null;
  text: string;
  uploadedUrl?: string;
}

export default function JobDescriptionUpload() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  // Get user data from Convex
  const convexUser = useQuery(api.users.getUserByClerkId, 
    user?.id ? { clerkId: user.id } : "skip"
  );

  // Convex mutations
  const createSession = useMutation(api.interviewSessions.createSession);

  // File ref
  const jobDescriptionFileRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [jobDescriptionData, setJobDescriptionData] = useState<FileUploadState>({
    file: null,
    text: '',
    uploading: false,
    uploadedUrl: ''
  });

  // Resume data from previous page
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);

  useEffect(() => {
    // Get resume data from sessionStorage
    const storedResumeData = sessionStorage.getItem('resumeData');
    if (storedResumeData) {
      setResumeData(JSON.parse(storedResumeData));
    } else {
      // If no resume data, redirect back to resume upload
      router.push('/dashboard/resume-upload');
    }
  }, [router]);

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

  // Upload file to ImageKit
  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', `${user?.id}_${Date.now()}_${file.name}`);
    formData.append('folder', folder);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const result = await response.json();
    return result.url;
  };

  const handleJobDescriptionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setJobDescriptionData(prev => ({ ...prev, file, uploading: true }));
      
      try {
        console.log('Processing job description file:', file.name, file.type, file.size);
        
        // Upload to ImageKit
        console.log('Uploading to ImageKit...');
        const uploadedUrl = await uploadFile(file, '/job-descriptions');
        console.log('Upload successful:', uploadedUrl);
        
        setJobDescriptionData(prev => ({ 
          ...prev, 
          uploading: false, 
          uploadedUrl,
          text: '' // User will need to paste manually
        }));
        
        // Inform user they need to paste content manually
        alert(
          `File uploaded successfully!\n\n` +
          `Please copy and paste your job description content in the text area below for the ATS analysis to work properly.`
        );
        
        console.log('Job description upload completed successfully');
      } catch (error) {
        console.error('Job description upload failed:', error);
        setJobDescriptionData(prev => ({ ...prev, uploading: false }));
        alert(`Failed to upload job description: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Function to extract text from file
  const extractTextFromFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/extract-text', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to extract text from file');
    }

    const result = await response.json();
    return result.text || '';
  };

  const handleJobDescriptionTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJobDescriptionData(prev => ({ ...prev, text: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!convexUser || !resumeData) {
      alert('User data not loaded. Please refresh the page.');
      return;
    }

    setIsLoading(true);
    
    try {
      const resumeContent = resumeData.text || '';
      const jobDescriptionContent = jobDescriptionData.text || '';

      if (!resumeContent.trim() || !jobDescriptionContent.trim()) {
        alert('Please provide both resume and job description content.');
        setIsLoading(false);
        return;
      }

      // Create interview session in Convex
      const sessionId = await createSession({
        userId: convexUser._id,
        resumeFileUrl: resumeData.uploadedUrl,
        resumeContent: resumeContent,
        jobDescriptionFileUrl: jobDescriptionData.uploadedUrl,
        jobDescriptionContent: jobDescriptionContent,
        status: 'ats_processing'
      });

      // Clean up sessionStorage
      sessionStorage.removeItem('resumeData');

      // Redirect to ATS report generation
      router.push(`/dashboard/ats-report/${sessionId}`);
    } catch (error) {
      console.error('Session creation failed:', error);
      alert('Failed to create interview session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = jobDescriptionData.file || jobDescriptionData.text.trim();

  if (!resumeData) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="loading-spinner-large"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="journey-container">
        <div className="dashboard-card journey-card">
          {/* Header */}
          <div className="journey-header">
            <h1 className="journey-title">Job Description</h1>
            <p className="journey-description">
              Upload the job description file or paste the job posting content to generate relevant interview questions
            </p>
          </div>

          {/* Progress Steps */}
          <div className="progress-steps">
            <div className="progress-step completed">
              <div className="step-circle">
                <span className="step-number">✓</span>
              </div>
              <span className="step-label">Upload Resume</span>
            </div>
            <div className="progress-line"></div>
            <div className="progress-step active">
              <div className="step-circle">
                <span className="step-number">2</span>
              </div>
              <span className="step-label">Job Description</span>
            </div>
            <div className="progress-line"></div>
            <div className="progress-step">
              <div className="step-circle">
                <span className="step-number">3</span>
              </div>
              <span className="step-label">Generate Questions</span>
            </div>
          </div>

          {/* Resume Summary */}
          <div className="resume-summary">
            <h3 className="resume-summary-title">Resume Uploaded</h3>
            <div className="resume-summary-content">
              {resumeData.file ? (
                <div className="file-summary">
                  <svg className="file-icon-small success" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                  </svg>
                  <span className="file-name-small">{resumeData.file.name}</span>
                  <span className="file-size-small">({(resumeData.file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              ) : (
                <div className="text-summary">
                  <span className="text-indicator">Text content provided</span>
                  <span className="text-length">({resumeData.text.length} characters)</span>
                </div>
              )}
            </div>
          </div>

          {/* Step Content */}
          <div className="step-content">
            <div className="step-header">
              <h2 className="step-title">Job Description</h2>
              <p className="step-description">
                Upload the job description file or paste the job posting content
              </p>
            </div>

            <div className="upload-options">
              {/* File Upload Option */}
              <div className="upload-option">
                <h3 className="upload-option-title">Option 1: Upload File</h3>
                <div 
                  className="file-upload-area"
                  onClick={() => jobDescriptionFileRef.current?.click()}
                >
                  <input
                    ref={jobDescriptionFileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleJobDescriptionFileChange}
                    className="file-input-hidden"
                  />
                  <div className="file-upload-content">
                    {jobDescriptionData.uploading ? (
                      <>
                        <div className="loading-spinner-large"></div>
                        <p className="upload-text">Uploading...</p>
                      </>
                    ) : jobDescriptionData.file ? (
                      <>
                        <svg className="file-icon success" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                        </svg>
                        <p className="file-name">{jobDescriptionData.file.name}</p>
                        <p className="file-size">{(jobDescriptionData.file.size / 1024 / 1024).toFixed(2)} MB</p>
                        {jobDescriptionData.uploadedUrl && <p className="upload-success">✓ Uploaded successfully</p>}
                      </>
                    ) : (
                      <>
                        <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="upload-text">Click to upload job description</p>
                        <p className="upload-subtext">PDF, DOC, DOCX, or TXT</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="upload-divider">
                <span className="divider-text">OR</span>
              </div>

              {/* Text Input Option */}
              <div className="upload-option">
                <h3 className="upload-option-title">Option 2: Paste Content</h3>
                <textarea
                  value={jobDescriptionData.text}
                  onChange={handleJobDescriptionTextChange}
                  placeholder="Paste the job description here..."
                  className="content-textarea"
                  rows={10}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="journey-actions">
            <button
              onClick={() => router.push('/dashboard/resume-upload')}
              className="btn-secondary"
              disabled={isLoading}
            >
              Back to Resume
            </button>

            <button
              onClick={handleSubmit}
              disabled={!canProceed || jobDescriptionData.uploading || isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Creating Interview...' : 'Generate Questions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}