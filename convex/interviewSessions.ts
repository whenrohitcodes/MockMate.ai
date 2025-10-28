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
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("interviewSessions", {
      userId: args.userId,
      resumeFileUrl: args.resumeFileUrl,
      resumeContent: args.resumeContent,
      jobDescriptionFileUrl: args.jobDescriptionFileUrl,
      jobDescriptionContent: args.jobDescriptionContent,
      status: "uploading",
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
    generatedQuestions: v.optional(v.array(v.string())),
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