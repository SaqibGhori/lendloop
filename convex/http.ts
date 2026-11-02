import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verify } from "./lib/hmac";

const http = httpRouter();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Reads the raw body and rejects anything without a valid, fresh signature. */
async function signedBody(req: Request): Promise<string | null> {
  const raw = await req.text();
  const ok = await verify(req.headers.get("x-lendloop-timestamp"), req.headers.get("x-lendloop-signature"), raw);
  return ok ? raw : null;
}

/** n8n daily job: list overdue loans. POST so the (empty) body is covered by the signature. */
http.route({
  path: "/n8n/overdue",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if ((await signedBody(req)) === null) return json(401, { error: "bad signature" });
    return json(200, { loans: await ctx.runQuery(internal.automation.overdue, {}) });
  }),
});

/** n8n write-back: reminder or notification result, idempotent on `key`. */
http.route({
  path: "/n8n/log",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const raw = await signedBody(req);
    if (raw === null) return json(401, { error: "bad signature" });
    let body: { key?: unknown; loanId?: unknown; kind?: unknown; status?: unknown; message?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: "invalid JSON" });
    }
    const kinds = ["notification", "overdue_reminder", "error"];
    if (
      typeof body.key !== "string" ||
      typeof body.loanId !== "string" ||
      typeof body.message !== "string" ||
      !kinds.includes(body.kind as string) ||
      (body.status !== "sent" && body.status !== "failed")
    ) {
      return json(400, { error: "missing or invalid fields" });
    }
    try {
      const result = await ctx.runMutation(internal.automation.log, {
        key: body.key.slice(0, 200),
        loanId: body.loanId as Id<"loans">,
        kind: body.kind as "notification" | "overdue_reminder" | "error",
        status: body.status,
        message: body.message,
      });
      return json(result.ok ? 200 : 404, result);
    } catch {
      return json(400, { error: "invalid loanId" });
    }
  }),
});

export default http;
