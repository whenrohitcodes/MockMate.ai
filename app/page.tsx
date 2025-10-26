"use client";

import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="page-container">
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Master Your Interview Skills with AI
            </h1>
            <p className="hero-subtitle">
              Practice with AI-powered mock interviews, get instant feedback, and boost your confidence for the real thing.
            </p>
            <div className="hero-buttons">
              <SignedOut>
                <SignInButton>
                  <button className="btn-primary">
                    Start Free Mock Interview
                  </button>
                </SignInButton>
                <button className="btn-secondary">
                  Learn More
                </button>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard">
                  <button className="btn-primary">
                    Go to Dashboard
                  </button>
                </Link>
                <button className="btn-secondary">
                  Learn More
                </button>
              </SignedIn>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features-section">
        <div className="container">
          <h2 className="section-title">
            Why Choose AI Mock Interview?
          </h2>
          <div className="features-grid">
            <div className="feature-card blue">
              <div className="feature-icon blue">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="feature-title">AI-Powered Questions</h3>
              <p className="feature-description">Get personalized interview questions tailored to your role, industry, and experience level.</p>
            </div>
            <div className="feature-card purple">
              <div className="feature-icon purple">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="feature-title">Real-Time Feedback</h3>
              <p className="feature-description">Receive instant, constructive feedback on your answers to improve your performance.</p>
            </div>
            <div className="feature-card green">
              <div className="feature-icon green">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="feature-title">Track Your Progress</h3>
              <p className="feature-description">Monitor your improvement over time with detailed analytics and performance metrics.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="container">
          <h2 className="section-title">
            How It Works
          </h2>
          <div className="steps-grid">
            <div className="step-item">
              <div className="step-number blue">
                1
              </div>
              <h3 className="step-title">Choose Your Role</h3>
              <p className="step-description">Select the job position you're preparing for</p>
            </div>
            <div className="step-item">
              <div className="step-number purple">
                2
              </div>
              <h3 className="step-title">Start Interview</h3>
              <p className="step-description">Begin your AI-powered mock interview session</p>
            </div>
            <div className="step-item">
              <div className="step-number green">
                3
              </div>
              <h3 className="step-title">Answer Questions</h3>
              <p className="step-description">Respond to personalized interview questions</p>
            </div>
            <div className="step-item">
              <div className="step-number indigo">
                4
              </div>
              <h3 className="step-title">Get Feedback</h3>
              <p className="step-description">Receive detailed feedback and improve</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-pattern"></div>
        <div className="container stats-content">
          <div className="stats-grid">
            <div>
              <div className="stat-number">10K+</div>
              <div className="stat-label">Mock Interviews Conducted</div>
            </div>
            <div>
              <div className="stat-number">95%</div>
              <div className="stat-label">User Satisfaction Rate</div>
            </div>
            <div>
              <div className="stat-number">500+</div>
              <div className="stat-label">Companies Covered</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="about" className="cta-section">
        <div className="cta-container">
          <h2 className="cta-title">
            Ready to Ace Your Next Interview?
          </h2>
          <p className="cta-description">
            Join thousands of successful candidates who improved their interview skills with our AI-powered platform.
          </p>
          <SignedOut>
            <SignInButton>
              <button className="btn-cta">
                Get Started Now - It's Free
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <button className="btn-cta">
                Go to Dashboard
              </button>
            </Link>
          </SignedIn>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <h3>AI Mock Interview</h3>
              <p>Empowering candidates to succeed in their career journey.</p>
            </div>
            <div className="footer-section">
              <h4>Product</h4>
              <ul className="footer-links">
                <li><a href="#">Features</a></li>
                <li><a href="#">Pricing</a></li>
                <li><a href="#">FAQ</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Company</h4>
              <ul className="footer-links">
                <li><a href="#">About Us</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Legal</h4>
              <ul className="footer-links">
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 AI Mock Interview. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
