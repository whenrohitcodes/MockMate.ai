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
});