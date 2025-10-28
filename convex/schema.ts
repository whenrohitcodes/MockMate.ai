import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table to store user information from Clerk
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  // Mock interviews table
  mockInterviews: defineTable({
    userId: v.id("users"),
    jobRole: v.string(),
    jobDescription: v.string(),
    jobExperience: v.string(),
    questions: v.array(v.string()),
    createdAt: v.number(),
    isCompleted: v.boolean(),
  }).index("by_user", ["userId"]),

  // User answers for mock interviews
  userAnswers: defineTable({
    mockId: v.id("mockInterviews"),
    userId: v.id("users"),
    question: v.string(),
    userAnswer: v.string(),
    feedback: v.optional(v.string()),
    rating: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_mock", ["mockId"])
   .index("by_user", ["userId"]),

  // User progress tracking
  userProgress: defineTable({
    userId: v.id("users"),
    totalInterviews: v.number(),
    averageRating: v.number(),
    improvementAreas: v.array(v.string()),
    strengths: v.array(v.string()),
    lastUpdated: v.number(),
  }).index("by_user", ["userId"]),

  // Interview sessions with file uploads
  interviewSessions: defineTable({
    userId: v.id("users"),
    resumeFileUrl: v.optional(v.string()),
    resumeContent: v.optional(v.string()),
    jobDescriptionFileUrl: v.optional(v.string()),
    jobDescriptionContent: v.optional(v.string()),
    status: v.string(), // "uploading", "processing", "ready", "in_progress", "completed"
    generatedQuestions: v.optional(v.array(v.string())),
    vapiSessionId: v.optional(v.string()),
    overallScore: v.optional(v.number()),
    feedbackData: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Question responses for detailed tracking
  questionResponses: defineTable({
    sessionId: v.id("interviewSessions"),
    questionNumber: v.number(),
    question: v.string(),
    response: v.string(),
    audioUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
    confidenceScore: v.optional(v.number()),
    relevanceScore: v.optional(v.number()),
    feedback: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),
});