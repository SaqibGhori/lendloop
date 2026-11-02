import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { today } from "./lib/auth";

/** Overdue = approved, not returned, and the last loan day is before today. Minimal fields only. */
export const overdue = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = today();
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_end", (q) => q.eq("status", "approved").lt("endDate", now))
      .collect();
    return Promise.all(
      loans.map(async (l) => {
        const [tool, borrower] = await Promise.all([ctx.db.get(l.toolId), ctx.db.get(l.borrowerId)]);
        return {
          loanId: l._id,
          tool: tool?.name ?? "a tool",
          endDate: l.endDate,
          daysOverdue: Math.round((Date.parse(now) - Date.parse(l.endDate)) / 86_400_000),
          borrower: { userId: l.borrowerId, name: borrower?.name ?? "Neighbor" },
          // One reminder per loan per day: n8n sends this key back, so retries never duplicate.
          reminderKey: `overdue:${l._id}:${now}`,
        };
      }),
    );
  },
});

/** Idempotent write-back from n8n: the same key twice is a no-op. */
export const log = internalMutation({
  args: {
    key: v.string(),
    loanId: v.id("loans"),
    kind: v.union(v.literal("notification"), v.literal("overdue_reminder"), v.literal("error")),
    status: v.union(v.literal("sent"), v.literal("failed")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.loanId))) return { ok: false, reason: "unknown loan" } as const;
    const existing = await ctx.db.query("automationLog").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
    if (existing) {
      // A failed attempt can be upgraded to sent by a later retry; anything else is a duplicate.
      if (existing.status === "failed" && args.status === "sent") {
        await ctx.db.patch(existing._id, { status: "sent", message: args.message.slice(0, 300), at: Date.now() });
        return { ok: true, duplicate: false } as const;
      }
      return { ok: true, duplicate: true } as const;
    }
    await ctx.db.insert("automationLog", { ...args, message: args.message.slice(0, 300), at: Date.now() });
    return { ok: true, duplicate: false } as const;
  },
});
