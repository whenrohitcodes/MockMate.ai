import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save user answer for a question
export const saveUserAnswer = mutation({
  args: {
    mockId: v.id("mockInterviews"),
    userId: v.id("users"),
    question: v.string(),
    userAnswer: v.string(),
    feedback: v.optional(v.string()),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const answerId = await ctx.db.insert("userAnswers", {
      mockId: args.mockId,
      userId: args.userId,
      question: args.question,
      userAnswer: args.userAnswer,
      feedback: args.feedback,
      rating: args.rating,
      createdAt: Date.now(),
    });

    return answerId;
  },
});

// Get answers for a specific mock interview
export const getAnswersByMock = query({
  args: { mockId: v.id("mockInterviews") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userAnswers")
      .withIndex("by_mock", (q) => q.eq("mockId", args.mockId))
      .collect();
  },
});

// Get all answers by user
export const getAnswersByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userAnswers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Update answer with feedback and rating
export const updateAnswerFeedback = mutation({
  args: {
    id: v.id("userAnswers"),
    feedback: v.string(),
    rating: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      feedback: args.feedback,
      rating: args.rating,
    });
  },
});

// Get user statistics
export const getUserStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const answers = await ctx.db
      .query("userAnswers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const totalAnswers = answers.length;
    const answersWithRating = answers.filter(a => a.rating !== undefined);
    const averageRating = answersWithRating.length > 0 
      ? answersWithRating.reduce((sum, a) => sum + (a.rating || 0), 0) / answersWithRating.length
      : 0;

    const mockInterviews = await ctx.db
      .query("mockInterviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return {
      totalAnswers,
      averageRating: Math.round(averageRating * 100) / 100,
      totalInterviews: mockInterviews.length,
      completedInterviews: mockInterviews.filter(m => m.isCompleted).length,
    };
  },
});