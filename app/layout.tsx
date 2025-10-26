import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import { ClerkProvider } from '@clerk/nextjs';
import { ConvexClientProvider } from './ConvexClientProvider';
import UserSync from './components/UserSync';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Mock Interview - Practice & Perfect Your Interview Skills",
  description: "Enhance your interview skills with AI-powered mock interviews. Get real-time feedback, personalized questions, and improve your confidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          suppressHydrationWarning={true}
        >
          <ConvexClientProvider>
            <UserSync />
            <Header />
            <main>
              {children}
            </main>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
