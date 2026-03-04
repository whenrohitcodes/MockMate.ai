"use client";

import { useState, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { redirect, useRouter } from 'next/navigation';

interface FileUploadState {
  file: File | null;
  text: string;
  uploading: boolean;
  uploadedUrl?: string;
}

export default function ResumeUpload() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  // Get user data from Convex
  const convexUser = useQuery(api.users.getUserByClerkId, 
    user?.id ? { clerkId: user.id } : "skip"
  );

  // File ref
  const resumeFileRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [resumeData, setResumeData] = useState<FileUploadState>({
    file: null,
    text: '',
    uploading: false,
    uploadedUrl: ''
  });

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
      const errorText = await response.text().catch(() => '');
      throw new Error(`Upload failed${errorText ? `: ${errorText}` : ''}`);
    }

    const result = await response.json();
    return result.url;
  };

  const handleResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResumeData(prev => ({ ...prev, file, uploading: true }));
      
      try {
        console.log('Processing file:', file.name, file.type, file.size);

        // Extract text first so the user can proceed even if upload fails
        let extractedText = '';
        try {
          extractedText = await extractTextFromFile(file);
          console.log('Resume text extracted, length:', extractedText.length);
        } catch (extractionError) {
          console.error('Resume text extraction failed:', extractionError);
        }

        // Attempt upload, but if it fails keep extracted text so user can proceed
        let uploadedUrl = '';
        try {
          console.log('Uploading to ImageKit...');
          uploadedUrl = await uploadFile(file, '/resumes');
          console.log('Upload successful:', uploadedUrl);
        } catch (uploadError) {
          console.error('Resume upload failed:', uploadError);
          alert('Upload failed, but we extracted the text. You can continue without the upload.');
        }

        setResumeData(prev => ({ 
          ...prev, 
          file,
          uploading: false, 
          uploadedUrl,
          text: extractedText
        }));

        console.log('State updated. Text length:', extractedText.length, 'Type:', typeof extractedText);

        if (extractedText && uploadedUrl) {
          alert('File uploaded and parsed successfully! Extracted ' + extractedText.length + ' characters.');
        } else if (extractedText && !uploadedUrl) {
          alert('Text extracted successfully (' + extractedText.length + ' characters), but upload to storage failed. You can still continue.');
        } else {
          alert('We could not read your resume automatically. Please try a different file format (PDF, DOCX, or TXT).');
        }
        
        console.log('Resume processing completed');
      } catch (error) {
        console.error('Resume upload failed:', error);
        setResumeData(prev => ({ ...prev, uploading: false }));
        alert(`Failed to upload resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const errorBody = await response.json().catch(() => null);
      const message = errorBody?.details || errorBody?.error || `Failed to extract text (status ${response.status})`;
      throw new Error(message);
    }

    const result = await response.json();
    if (!result?.text) {
      throw new Error('No text returned from extractor');
    }
    return result.text;
  };

  const handleResumeTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResumeData(prev => ({ ...prev, text: e.target.value }));
  };

  const handleNextStep = () => {
    if (!resumeData.text || !resumeData.text.trim()) {
      alert('We could not read your resume. Please try uploading a different file format.');
      return;
    }

    // Store resume data in sessionStorage to pass to next page
    const resumeInfo = {
      file: resumeData.file ? {
        name: resumeData.file.name,
        size: resumeData.file.size,
        type: resumeData.file.type
      } : null,
      text: resumeData.text,
      uploadedUrl: resumeData.uploadedUrl
    };
    sessionStorage.setItem('resumeData', JSON.stringify(resumeInfo));
    router.push('/dashboard/job-description');
  };

  const canProceed = !!(resumeData.text && typeof resumeData.text === 'string' && resumeData.text.trim());

  console.log('Render - canProceed:', canProceed, 'text type:', typeof resumeData.text, 'text length:', resumeData.text?.length, 'uploading:', resumeData.uploading);

  return (
    <div className="dashboard-container">
      <div className="journey-container">
        <div className="dashboard-card journey-card">
          {/* Header */}
          <div className="journey-header">
            <h1 className="journey-title">Upload Your Resume</h1>
            <p className="journey-description">
              Upload your resume file to get an ATS compatibility analysis
            </p>
          </div>

          {/* Progress Steps */}
          <div className="progress-steps">
            <div className="progress-step active">
              <div className="step-circle">
                <span className="step-number">1</span>
              </div>
              <span className="step-label">Upload Resume</span>
            </div>
            <div className="progress-line"></div>
            <div className="progress-step">
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
              <span className="step-label">ATS Report</span>
            </div>
          </div>

          {/* Step Content */}
          <div className="step-content">
            <div className="step-header">
              <h2 className="step-title">Upload Your Resume</h2>
              <p className="step-description">
                Upload your resume file (PDF, DOC, DOCX, or TXT)
              </p>
            </div>

            <div className="upload-options">
              {/* File Upload Option */}
              <div className="upload-option">
                <h3 className="upload-option-title">Upload File</h3>
                <div 
                  className="file-upload-area"
                  onClick={() => resumeFileRef.current?.click()}
                >
                  <input
                    ref={resumeFileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleResumeFileChange}
                    className="file-input-hidden"
                  />
                  <div className="file-upload-content">
                    {resumeData.uploading ? (
                      <>
                        <div className="loading-spinner-large"></div>
                        <p className="upload-text">Uploading...</p>
                      </>
                    ) : resumeData.file ? (
                      <>
                        <svg className="file-icon success" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                        </svg>
                        <p className="file-name">{resumeData.file.name}</p>
                        <p className="file-size">{(resumeData.file.size / 1024 / 1024).toFixed(2)} MB</p>
                        {resumeData.uploadedUrl && <p className="upload-success">✓ Uploaded successfully</p>}
                        {resumeData.text && <p className="upload-success">✓ Extracted {resumeData.text.length} characters</p>}
                      </>
                    ) : (
                      <>
                        <svg className="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="upload-text">Click to upload resume</p>
                        <p className="upload-subtext">PDF, DOC, DOCX, or TXT</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="journey-actions">
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-secondary"
            >
              Cancel
            </button>

            <button
              onClick={handleNextStep}
              disabled={!canProceed || resumeData.uploading}
              className="btn-primary"
            >
              {resumeData.uploading ? 'Uploading...' : 'Next: Job Description'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}