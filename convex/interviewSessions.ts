import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new interview session
export const createSession = mutation({
  args: {
    userId: v.id("users"),
    resumeFileUrl: v.optional(v.string()),
    resumeContent: v.optional(v.string()),
    jobDescriptionFileUrl: v.optional(v.string()),
    jobDescriptionContent: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("interviewSessions", {
      userId: args.userId,
      resumeFileUrl: args.resumeFileUrl,
      resumeContent: args.resumeContent,
      jobDescriptionFileUrl: args.jobDescriptionFileUrl,
      jobDescriptionContent: args.jobDescriptionContent,
      status: args.status || "uploading",
      createdAt: Date.now(),
    });

    return sessionId;
  },
});

// Update session status
export const updateSessionStatus = mutation({
  args: {
    sessionId: v.id("interviewSessions"),
    status: v.string(),
    generatedQuestions: v.optional(v.array(v.object({
      id: v.number(),
      question: v.string(),
      type: v.string(),
      category: v.string(),
      difficulty: v.string(),
      expectedDuration: v.string(),
      followUpSuggestions: v.array(v.string()),
    }))),
    vapiSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updateData: any = {
      status: args.status,
    };

    if (args.generatedQuestions) {
      updateData.generatedQuestions = args.generatedQuestions;
    }

    if (args.vapiSessionId) {
      updateData.vapiSessionId = args.vapiSessionId;
    }

    await ctx.db.patch(args.sessionId, updateData);
  },
});

// Get session by ID
export const getSession = query({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

// Get session by ID (alias for consistency)
export const getSessionById = query({
  args: { sessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

// Update session with comprehensive data
export const updateSession = mutation({
  args: {
    sessionId: v.id("interviewSessions"),
    updates: v.object({
      status: v.optional(v.string()),
      atsScore: v.optional(v.number()),
      atsReport: v.optional(v.string()),
      parsedResumeData: v.optional(v.string()),
      aiModel: v.optional(v.string()),
      interviewType: v.optional(v.string()),
      difficulty: v.optional(v.string()),
      interviewDuration: v.optional(v.number()),
      generatedQuestions: v.optional(v.array(v.object({
        id: v.number(),
        question: v.string(),
        type: v.string(),
        category: v.string(),
        difficulty: v.string(),
        expectedDuration: v.string(),
        followUpSuggestions: v.array(v.string()),
      }))),
      vapiSessionId: v.optional(v.string()),
      vapiCallId: v.optional(v.string()),
      overallScore: v.optional(v.number()),
      technicalScore: v.optional(v.number()),
      communicationScore: v.optional(v.number()),
      confidenceScore: v.optional(v.number()),
      feedbackData: v.optional(v.string()),
      improvementAreas: v.optional(v.array(v.string())),
      strengths: v.optional(v.array(v.string())),
      completedAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, args.updates);
  },
});

// Get sessions by user
export const getSessionsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("interviewSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Complete session with feedback
export const completeSession = mutation({
  args: {
    sessionId: v.id("interviewSessions"),
    overallScore: v.number(),
    feedbackData: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: "completed",
      overallScore: args.overallScore,
      feedbackData: args.feedbackData,
      completedAt: Date.now(),
    });
  },
});