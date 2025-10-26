"use client";

import { useState, useEffect } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-linear-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">AI</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Mock Interview</span>
            </a>
          </div>

          {/* Desktop Navigation - All on Right */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-700 hover:text-blue-600 transition font-medium">
              Features
            </a>
            <a href="#how-it-works" className="text-gray-700 hover:text-blue-600 transition font-medium">
              How It Works
            </a>
            <a href="#about" className="text-gray-700 hover:text-blue-600 transition font-medium">
              About
            </a>
            <SignedOut>
              <SignInButton>
                <button className="text-gray-700 hover:text-blue-600 transition font-medium">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-700 hover:text-blue-600 transition"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden py-4 border-t border-gray-200 ${isMobileMenuOpen && mounted ? 'block' : 'hidden'}`}>
          <div className="flex flex-col space-y-4">
            <a
              href="#features"
              className="text-gray-700 hover:text-blue-600 transition font-medium"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-gray-700 hover:text-blue-600 transition font-medium"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              How It Works
            </a>
            <a
              href="#about"
              className="text-gray-700 hover:text-blue-600 transition font-medium"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              About
            </a>
            <div className="pt-4 border-t border-gray-200">
              <SignedOut>
                <SignInButton>
                  <button className="text-gray-700 hover:text-blue-600 transition font-medium text-left">
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <div className="flex items-center">
                  <UserButton />
                </div>
              </SignedIn>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
