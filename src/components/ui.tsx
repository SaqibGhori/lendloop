"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { ConvexError } from "convex/values";
import type { ReactNode } from "react";

/** Gate for signed-in pages. Convex still enforces every rule server-side. */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (!isLoaded || (isSignedIn && isLoading)) return <p className="text-sm text-stone-500">Loading…</p>;
  if (!isSignedIn) {
    return (
      <div className="card text-center">
        <p className="mb-3 text-stone-600">Sign in to lend or borrow.</p>
        <SignInButton mode="modal">
          <button className="btn-primary">Sign in</button>
        </SignInButton>
      </div>
    );
  }
  if (!isAuthenticated) return <p className="text-sm text-red-700">Signed in, but the data service did not accept the session.</p>;
  return <>{children}</>;
}

const STATUS_STYLE: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800",
  "on loan": "bg-sky-100 text-sky-800",
  overdue: "bg-red-100 text-red-800",
  requested: "bg-amber-100 text-amber-800",
  approved: "bg-sky-100 text-sky-800",
  declined: "bg-stone-200 text-stone-700",
  cancelled: "bg-stone-200 text-stone-700",
  returned: "bg-emerald-100 text-emerald-800",
};

export function StatusChip({ status }: { status: string }) {
  return <span className={`chip ${STATUS_STYLE[status] ?? "bg-stone-100 text-stone-700"}`}>{status}</span>;
}

export function errorText(e: unknown): string {
  if (e instanceof ConvexError) return String(e.data);
  return "Something went wrong. Please try again.";
}

export function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function formatRange(start: string, end: string) {
  const f = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
}
