import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create or update user progress
export const updateUserProgress = mutation({
  args: {
    userId: v.id("users"),
    totalInterviews: v.number(),
    averageRating: v.number(),
    improvementAreas: v.array(v.string()),
    strengths: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existingProgress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existingProgress) {
      await ctx.db.patch(existingProgress._id, {
        totalInterviews: args.totalInterviews,
        averageRating: args.averageRating,
        improvementAreas: args.improvementAreas,
        strengths: args.strengths,
        lastUpdated: Date.now(),
      });
      return existingProgress._id;
    }

    const progressId = await ctx.db.insert("userProgress", {
      userId: args.userId,
      totalInterviews: args.totalInterviews,
      averageRating: args.averageRating,
      improvementAreas: args.improvementAreas,
      strengths: args.strengths,
      lastUpdated: Date.now(),
    });

    return progressId;
  },
});

// Get user progress
export const getUserProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// Calculate and update progress automatically
export const calculateUserProgress = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get user's answers to calculate performance
    const answers = await ctx.db
      .query("userAnswers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const interviews = await ctx.db
      .query("mockInterviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const answersWithRating = answers.filter(a => a.rating !== undefined);
    const averageRating = answersWithRating.length > 0 
      ? answersWithRating.reduce((sum, a) => sum + (a.rating || 0), 0) / answersWithRating.length
      : 0;

    // Simple algorithm to determine improvement areas and strengths
    const lowRatingAnswers = answersWithRating.filter(a => (a.rating || 0) < 3);
    const highRatingAnswers = answersWithRating.filter(a => (a.rating || 0) >= 4);

    const improvementAreas = ["Communication", "Technical Skills", "Problem Solving"];
    const strengths = averageRating >= 4 ? ["Interview Performance", "Confidence"] : [];

    await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first()
      .then(async (existingProgress) => {
        if (existingProgress) {
          await ctx.db.patch(existingProgress._id, {
            totalInterviews: interviews.length,
            averageRating: Math.round(averageRating * 100) / 100,
            improvementAreas,
            strengths,
            lastUpdated: Date.now(),
          });
        } else {
          await ctx.db.insert("userProgress", {
            userId: args.userId,
            totalInterviews: interviews.length,
            averageRating: Math.round(averageRating * 100) / 100,
            improvementAreas,
            strengths,
            lastUpdated: Date.now(),
          });
        }
      });

    return { success: true };
  },
});