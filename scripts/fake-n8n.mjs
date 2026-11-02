// Stand-in for the n8n "loan status" webhook, for testing Convex without n8n running.
// Verifies the HMAC exactly like the n8n Code node, then writes the notification back to Convex.
// Usage: LENDLOOP_HMAC_SECRET=... CONVEX_SITE_URL=http://127.0.0.1:3211 node scripts/fake-n8n.mjs
import http from "node:http";
import crypto from "node:crypto";

const secret = process.env.LENDLOOP_HMAC_SECRET;
const site = process.env.CONVEX_SITE_URL ?? "http://127.0.0.1:3211";
const sign = (body) => {
  const ts = Math.floor(Date.now() / 1000).toString();
  return { ts, sig: "sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex") };
};

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      const ts = String(req.headers["x-lendloop-timestamp"] ?? "");
      const sig = String(req.headers["x-lendloop-signature"] ?? "");
      const expected = "sha256=" + crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
      const valid = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      if (!valid) {
        console.log("REJECTED bad signature");
        res.writeHead(401).end();
        return;
      }
      const e = JSON.parse(raw);
      const message = `Hi ${e.recipient.name}, ${e.tool}: ${e.status}`;
      console.log("[mock notification]", e.recipient.role, e.recipient.userId, message);
      const body = JSON.stringify({ key: `notify:${e.eventId}`, loanId: e.loanId, kind: "notification", status: "sent", message });
      const { ts: t2, sig: s2 } = sign(body);
      const r = await fetch(`${site}/n8n/log`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-lendloop-timestamp": t2, "x-lendloop-signature": s2 },
        body,
      });
      console.log("write-back", r.status, await r.text());
      res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
    });
  })
  .listen(5678, () => console.log("fake n8n on :5678"));
