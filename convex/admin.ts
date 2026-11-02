import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAdmin } from "./lib/auth";

export const lenders = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return Promise.all(
      users.map(async (u) => ({
        _id: u._id,
        name: u.name,
        role: u.role,
        trustedLender: u.trustedLender,
        listings: (await ctx.db.query("tools").withIndex("by_owner", (q) => q.eq("ownerId", u._id)).collect()).length,
      })),
    );
  },
});

export const setTrusted = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(userId))) throw new ConvexError("User not found.");
    await ctx.db.patch(userId, { trustedLender: trusted });
  },
});
