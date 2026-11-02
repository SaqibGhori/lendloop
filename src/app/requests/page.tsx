"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { RequireSignIn } from "@/components/ui";
import { LoanCard } from "@/components/LoanCard";

function Requests() {
  const [tab, setTab] = useState<"incoming" | "mine">("incoming");
  const incoming = useQuery(api.loans.incoming);
  const mine = useQuery(api.loans.myRequests);
  const loans = tab === "incoming" ? incoming : mine;
  const waiting = incoming?.filter((l) => l.status === "requested").length ?? 0;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Requests</h1>
      <div className="flex gap-1 border-b border-stone-200">
        {(
          [
            ["incoming", `Incoming requests${waiting ? ` (${waiting})` : ""}`],
            ["mine", "My requests"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === key ? "border-emerald-700 font-medium text-emerald-800" : "border-transparent text-stone-500"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {loans === undefined ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : loans.length === 0 ? (
        <p className="text-sm text-stone-500">{tab === "incoming" ? "Nobody has asked to borrow your tools yet." : "You have not asked to borrow anything yet."}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {loans.map((l) => (
            <LoanCard key={l._id} loan={l} side={tab === "incoming" ? "lender" : "borrower"} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RequestsPage() {
  return (
    <RequireSignIn>
      <Requests />
    </RequireSignIn>
  );
}
