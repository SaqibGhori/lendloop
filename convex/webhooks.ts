import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { signBody } from "./lib/hmac";

const MAX_ATTEMPTS = 5;

export const get = internalQuery({
  args: { eventId: v.id("webhookEvents") },
  handler: (ctx, { eventId }) => ctx.db.get(eventId),
});

export const record = internalMutation({
  args: { eventId: v.id("webhookEvents"), ok: v.boolean(), error: v.optional(v.string()) },
  handler: async (ctx, { eventId, ok, error }) => {
    const event = await ctx.db.get(eventId);
    if (!event) return { retry: false };
    const attempts = event.attempts + 1;
    if (ok) {
      await ctx.db.patch(eventId, { attempts, state: "delivered", lastError: undefined });
      return { retry: false };
    }
    const giveUp = attempts >= MAX_ATTEMPTS;
    await ctx.db.patch(eventId, { attempts, state: giveUp ? "failed" : "pending", lastError: error });
    if (giveUp) {
      // Never fail silently: the failure shows up in the loan's activity.
      await ctx.db.insert("automationLog", {
        key: `webhook-failed:${eventId}`,
        loanId: event.loanId,
        kind: "error",
        status: "failed",
        message: `Notification could not reach n8n after ${attempts} tries`,
        at: Date.now(),
      });
    }
    return { retry: !giveUp, attempts };
  },
});

/** POST one outbox event to the n8n webhook; on failure retry with backoff (2s, 4s, 8s, 16s). */
export const deliver = internalAction({
  args: { eventId: v.id("webhookEvents") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.runQuery(internal.webhooks.get, { eventId });
    if (!event || event.state !== "pending") return;
    const url = process.env.N8N_WEBHOOK_URL;
    let ok = false;
    let error: string | undefined;
    if (!url) {
      error = "N8N_WEBHOOK_URL is not set";
    } else {
      try {
        const { timestamp, signature } = await signBody(event.payload);
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-lendloop-timestamp": timestamp, "x-lendloop-signature": signature },
          body: event.payload,
        });
        ok = res.ok;
        if (!ok) error = `n8n answered ${res.status}`;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }
    const result = await ctx.runMutation(internal.webhooks.record, { eventId, ok, error });
    if (result.retry) {
      await ctx.scheduler.runAfter(1000 * 2 ** (result.attempts ?? 1), internal.webhooks.deliver, { eventId });
    }
  },
});
