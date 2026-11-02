import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/** Who should hear about each status change. */
const RECIPIENT: Record<Doc<"loans">["status"], "lender" | "borrower"> = {
  requested: "lender",
  cancelled: "lender",
  approved: "borrower",
  declined: "borrower",
  returned: "borrower",
};

/**
 * Store the event in an outbox and schedule delivery to n8n. The payload carries only what the
 * notification needs: a recipient id and display name, the tool name, dates and the new status.
 */
export async function emitLoanEvent(ctx: MutationCtx, loan: Doc<"loans">) {
  const tool = await ctx.db.get(loan.toolId);
  const role = RECIPIENT[loan.status];
  const recipient = await ctx.db.get(role === "lender" ? loan.lenderId : loan.borrowerId);
  const eventId = await ctx.db.insert("webhookEvents", {
    loanId: loan._id,
    type: "loan.status_changed",
    payload: "",
    attempts: 0,
    state: "pending",
  });
  const payload = JSON.stringify({
    eventId,
    type: "loan.status_changed",
    loanId: loan._id,
    status: loan.status,
    tool: tool?.name ?? "a tool",
    startDate: loan.startDate,
    endDate: loan.endDate,
    recipient: { userId: recipient?._id, name: recipient?.name, role },
    occurredAt: new Date().toISOString(),
  });
  await ctx.db.patch(eventId, { payload });
  await ctx.scheduler.runAfter(0, internal.webhooks.deliver, { eventId });
}
