import { mutation, query, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { CATEGORIES, CONDITIONS } from "./constants";
import { requireUser, today } from "./lib/auth";

type Availability = "available" | "on loan" | "overdue";

async function availability(ctx: QueryCtx, toolId: Id<"tools">): Promise<Availability> {
  const loans = await ctx.db.query("loans").withIndex("by_tool", (q) => q.eq("toolId", toolId)).collect();
  const now = today();
  const out = loans.find((l) => l.status === "approved" && l.startDate <= now);
  if (!out) return "available";
  return out.endDate < now ? "overdue" : "on loan";
}

function checkFields(f: { name: string; category: string; condition: string; description: string }) {
  const name = f.name.trim();
  if (name.length < 2 || name.length > 60) throw new ConvexError("Name must be 2 to 60 characters.");
  if (!(CATEGORIES as readonly string[]).includes(f.category)) throw new ConvexError("Unknown category.");
  if (!(CONDITIONS as readonly string[]).includes(f.condition)) throw new ConvexError("Unknown condition.");
  if (f.description.length > 500) throw new ConvexError("Description is limited to 500 characters.");
  return { name, category: f.category, condition: f.condition, description: f.description.trim() };
}

/** Public page: name and category only. No owner details for anonymous visitors. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db.query("tools").order("desc").take(100);
    const out = [];
    for (const t of tools) {
      if ((await availability(ctx, t._id)) === "available") out.push({ _id: t._id, name: t.name, category: t.category });
    }
    return out;
  },
});

/** Signed-in board: every tool with its status, optionally filtered by category. */
export const list = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, { category }) => {
    const me = await requireUser(ctx);
    const tools = category
      ? await ctx.db.query("tools").withIndex("by_category", (q) => q.eq("category", category)).collect()
      : await ctx.db.query("tools").order("desc").collect();
    return Promise.all(
      tools.map(async (t) => {
        const owner = (await ctx.db.get(t.ownerId)) as Doc<"users"> | null;
        return {
          ...t,
          status: await availability(ctx, t._id),
          ownerName: owner?.name ?? "Unknown",
          ownerTrusted: owner?.trustedLender ?? false,
          mine: t.ownerId === me._id,
        };
      }),
    );
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const tools = await ctx.db.query("tools").withIndex("by_owner", (q) => q.eq("ownerId", me._id)).collect();
    return Promise.all(tools.map(async (t) => ({ ...t, status: await availability(ctx, t._id) })));
  },
});

const fields = { name: v.string(), category: v.string(), condition: v.string(), description: v.string() };

export const create = mutation({
  args: fields,
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    return await ctx.db.insert("tools", { ownerId: me._id, ...checkFields(args) });
  },
});

export const update = mutation({
  args: { toolId: v.id("tools"), ...fields },
  handler: async (ctx, { toolId, ...args }) => {
    const me = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError("Tool not found.");
    if (tool.ownerId !== me._id) throw new ConvexError("You can only edit your own listings.");
    await ctx.db.patch(toolId, checkFields(args));
  },
});

/** Owners delete their own listing; admins can remove any. Open requests are cancelled with it. */
export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const me = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool) throw new ConvexError("Tool not found.");
    if (tool.ownerId !== me._id && me.role !== "admin") throw new ConvexError("You can only delete your own listings.");
    const loans = await ctx.db.query("loans").withIndex("by_tool", (q) => q.eq("toolId", toolId)).collect();
    if (loans.some((l) => l.status === "approved")) throw new ConvexError("This tool is lent out. Mark it returned first.");
    for (const l of loans) if (l.status === "requested") await ctx.db.patch(l._id, { status: "cancelled" });
    await ctx.db.delete(toolId);
  },
});
