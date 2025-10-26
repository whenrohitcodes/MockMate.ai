import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new mock interview
export const createMockInterview = mutation({
  args: {
    userId: v.id("users"),
    jobRole: v.string(),
    jobDescription: v.string(),
    jobExperience: v.string(),
    questions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const mockInterviewId = await ctx.db.insert("mockInterviews", {
      userId: args.userId,
      jobRole: args.jobRole,
      jobDescription: args.jobDescription,
      jobExperience: args.jobExperience,
      questions: args.questions,
      createdAt: Date.now(),
      isCompleted: false,
    });

    return mockInterviewId;
  },
});

// Get mock interviews by user
export const getMockInterviewsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mockInterviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get single mock interview
export const getMockInterview = query({
  args: { id: v.id("mockInterviews") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mark interview as completed
export const completeMockInterview = mutation({
  args: { id: v.id("mockInterviews") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isCompleted: true });
  },
});

// Delete a mock interview
export const deleteMockInterview = mutation({
  args: { id: v.id("mockInterviews") },
  handler: async (ctx, args) => {
    // First delete all related user answers
    const answers = await ctx.db
      .query("userAnswers")
      .withIndex("by_mock", (q) => q.eq("mockId", args.id))
      .collect();

    for (const answer of answers) {
      await ctx.db.delete(answer._id);
    }

    // Then delete the mock interview
    await ctx.db.delete(args.id);
  },
});