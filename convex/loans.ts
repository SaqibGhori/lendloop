import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUser, today } from "./lib/auth";
import { emitLoanEvent } from "./lib/events";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 30;

function days(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

async function hasOverlap(ctx: QueryCtx, toolId: Id<"tools">, start: string, end: string, skip?: Id<"loans">) {
  const loans = await ctx.db.query("loans").withIndex("by_tool", (q) => q.eq("toolId", toolId)).collect();
  return loans.some((l) => l._id !== skip && l.status === "approved" && l.startDate <= end && start <= l.endDate);
}

/** Loans joined with names and the latest automation activity, for the request views. */
async function present(ctx: QueryCtx, loans: Doc<"loans">[]) {
  return Promise.all(
    loans.map(async (l) => {
      const [tool, lender, borrower] = await Promise.all([ctx.db.get(l.toolId), ctx.db.get(l.lenderId), ctx.db.get(l.borrowerId)]);
      const activity = await ctx.db
        .query("automationLog")
        .withIndex("by_loan", (q) => q.eq("loanId", l._id))
        .order("desc")
        .take(3);
      return {
        ...l,
        toolName: tool?.name ?? "Removed tool",
        lenderName: lender?.name ?? "Unknown",
        borrowerName: borrower?.name ?? "Unknown",
        overdue: l.status === "approved" && l.endDate < today(),
        activity: activity.map((a) => ({ kind: a.kind, status: a.status, message: a.message, at: a.at })),
      };
    }),
  );
}

export const request = mutation({
  args: { toolId: v.id("tools"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { toolId, startDate, endDate }) => {
    const me = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError("Tool not found.");
    if (tool.ownerId === me._id) throw new ConvexError("You cannot borrow your own tool.");
    if (!DATE.test(startDate) || !DATE.test(endDate)) throw new ConvexError("Use valid dates.");
    if (startDate < today()) throw new ConvexError("The start date is in the past.");
    if (endDate < startDate) throw new ConvexError("The end date is before the start date.");
    if (days(startDate, endDate) > MAX_DAYS) throw new ConvexError(`Loans are limited to ${MAX_DAYS} days.`);
    if (await hasOverlap(ctx, toolId, startDate, endDate)) throw new ConvexError("The tool is already lent out on those dates.");
    const mine = await ctx.db.query("loans").withIndex("by_borrower", (q) => q.eq("borrowerId", me._id)).collect();
    if (mine.some((l) => l.toolId === toolId && l.status === "requested")) throw new ConvexError("You already have an open request for this tool.");
    const loanId = await ctx.db.insert("loans", { toolId, lenderId: tool.ownerId, borrowerId: me._id, startDate, endDate, status: "requested" });
    await emitLoanEvent(ctx, (await ctx.db.get(loanId))!);
    return loanId;
  },
});

/** Shared guard for status changes: the loan must exist, involve the caller, and be in `from`. */
async function transition(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  actor: "lender" | "borrower",
  from: Doc<"loans">["status"],
) {
  const me = await requireUser(ctx);
  const loan = await ctx.db.get(loanId);
  if (!loan) throw new ConvexError("Request not found.");
  const owner = actor === "lender" ? loan.lenderId : loan.borrowerId;
  if (owner !== me._id) throw new ConvexError("You can only act on requests for your own tools or your own borrowing.");
  if (loan.status !== from) throw new ConvexError(`This request is already ${loan.status}.`);
  return loan;
}

export const approve = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await transition(ctx, loanId, "lender", "requested");
    if (await hasOverlap(ctx, loan.toolId, loan.startDate, loan.endDate, loanId)) {
      throw new ConvexError("Another approved loan overlaps these dates.");
    }
    await ctx.db.patch(loanId, { status: "approved" });
    await emitLoanEvent(ctx, (await ctx.db.get(loanId))!);
  },
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    await transition(ctx, loanId, "lender", "requested");
    await ctx.db.patch(loanId, { status: "declined" });
    await emitLoanEvent(ctx, (await ctx.db.get(loanId))!);
  },
});

export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    await transition(ctx, loanId, "borrower", "requested");
    await ctx.db.patch(loanId, { status: "cancelled" });
    await emitLoanEvent(ctx, (await ctx.db.get(loanId))!);
  },
});

/** The lender confirms the tool came back. */
export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    await transition(ctx, loanId, "lender", "approved");
    await ctx.db.patch(loanId, { status: "returned", returnedAt: Date.now() });
    await emitLoanEvent(ctx, (await ctx.db.get(loanId))!);
  },
});

export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const loans = await ctx.db.query("loans").withIndex("by_borrower", (q) => q.eq("borrowerId", me._id)).order("desc").collect();
    return present(ctx, loans);
  },
});

export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const loans = await ctx.db.query("loans").withIndex("by_lender", (q) => q.eq("lenderId", me._id)).order("desc").collect();
    return present(ctx, loans);
  },
});

export const all = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    if (me.role !== "admin") throw new ConvexError("Admins only.");
    return present(ctx, await ctx.db.query("loans").order("desc").take(200));
  },
});
