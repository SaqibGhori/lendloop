import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Dev-only: move a loan's dates into the past so the overdue workflow has something to find.
 * Internal functions cannot be called from the browser; run with `npx convex run devtools:backdate`.
 */
export const backdate = internalMutation({
  args: { loanId: v.id("loans"), daysAgo: v.number() },
  handler: async (ctx, { loanId, daysAgo }) => {
    if (process.env.ENABLE_DEV_TOOLS !== "1") throw new Error("Set ENABLE_DEV_TOOLS=1 on the deployment first.");
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    await ctx.db.patch(loanId, { startDate: day(daysAgo + 3), endDate: day(daysAgo) });
  },
});
