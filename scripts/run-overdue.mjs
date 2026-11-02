// Runs the same steps as the n8n "daily overdue reminders" workflow, for testing without n8n.
// Usage: LENDLOOP_HMAC_SECRET=... CONVEX_SITE_URL=http://127.0.0.1:3211 node scripts/run-overdue.mjs
import crypto from "node:crypto";

const secret = process.env.LENDLOOP_HMAC_SECRET;
const site = process.env.CONVEX_SITE_URL ?? "http://127.0.0.1:3211";

async function signedPost(path, body, sigOverride) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = sigOverride ?? "sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const res = await fetch(`${site}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-lendloop-timestamp": ts, "x-lendloop-signature": sig },
    body,
  });
  return { status: res.status, body: await res.json() };
}

const forged = await signedPost("/n8n/overdue", "{}", "sha256=" + "0".repeat(64));
console.log("forged signature ->", forged.status);

const { body } = await signedPost("/n8n/overdue", "{}");
console.log("overdue loans:", body.loans.length);
for (const l of body.loans) {
  const message = `Hi ${l.borrower.name}, the ${l.tool} was due back on ${l.endDate} (${l.daysOverdue} days ago).`;
  const payload = JSON.stringify({ key: l.reminderKey, loanId: l.loanId, kind: "overdue_reminder", status: "sent", message });
  const first = await signedPost("/n8n/log", payload);
  const retry = await signedPost("/n8n/log", payload);
  console.log(l.reminderKey, "first:", JSON.stringify(first.body), "retry:", JSON.stringify(retry.body));
}
