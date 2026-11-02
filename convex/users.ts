import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { currentUser, isAdminSubject } from "./lib/auth";

/** Called once after sign-in. Creates the user row; the role comes from server config only. */
export const ensure = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const role = isAdminSubject(identity.subject) ? "admin" : "user";
    const displayName = name.trim().slice(0, 60) || "Neighbor";
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (existing) {
      if (existing.role !== role || existing.name !== displayName) {
        await ctx.db.patch(existing._id, { role, name: displayName });
      }
      return existing._id;
    }
    return await ctx.db.insert("users", { tokenIdentifier: identity.tokenIdentifier, name: displayName, role, trustedLender: false });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    return user && { _id: user._id, name: user.name, role: user.role, trustedLender: user.trustedLender };
  },
});
