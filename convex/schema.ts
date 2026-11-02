import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const loanStatus = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);

export default defineSchema({
  // Only what the app needs: no email, no phone. Notifications go through n8n by user id.
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    trustedLender: v.boolean(),
  }).index("by_token", ["tokenIdentifier"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: v.string(),
    condition: v.string(),
    description: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_category", ["category"]),

  loans: defineTable({
    toolId: v.id("tools"),
    lenderId: v.id("users"),
    borrowerId: v.id("users"),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD, last day of the loan
    status: loanStatus,
    returnedAt: v.optional(v.number()),
  })
    .index("by_tool", ["toolId"])
    .index("by_lender", ["lenderId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_status_end", ["status", "endDate"]),

  // Outbox for Convex -> n8n webhooks: each status change is one event, retried until delivered.
  webhookEvents: defineTable({
    loanId: v.id("loans"),
    type: v.string(),
    payload: v.string(), // exact JSON body that is signed
    attempts: v.number(),
    state: v.union(v.literal("pending"), v.literal("delivered"), v.literal("failed")),
    lastError: v.optional(v.string()),
  }).index("by_loan", ["loanId"]),

  // Write-backs from n8n. `key` makes every write idempotent (retries never duplicate).
  automationLog: defineTable({
    key: v.string(),
    loanId: v.id("loans"),
    kind: v.union(v.literal("notification"), v.literal("overdue_reminder"), v.literal("error")),
    status: v.union(v.literal("sent"), v.literal("failed")),
    message: v.string(),
    at: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_loan", ["loanId"]),
});
