/**
 * Signing scheme shared by both directions (Convex -> n8n and n8n -> Convex):
 *   X-LendLoop-Timestamp: unix seconds
 *   X-LendLoop-Signature: sha256=<hex HMAC-SHA256 of `${timestamp}.${rawBody}`>
 * The timestamp is part of the signed message, so a captured request cannot be replayed later.
 */
export const MAX_SKEW_SECONDS = 300;

function secret(): string {
  const s = process.env.LENDLOOP_HMAC_SECRET;
  if (!s || s.length < 32) throw new Error("LENDLOOP_HMAC_SECRET is missing or shorter than 32 characters.");
  return s;
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signBody(body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return { timestamp, signature: `sha256=${await hmacHex(`${timestamp}.${body}`)}` };
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verify(timestamp: string | null, signature: string | null, body: string): Promise<boolean> {
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  return safeEqual(signature, `sha256=${await hmacHex(`${timestamp}.${body}`)}`);
}
