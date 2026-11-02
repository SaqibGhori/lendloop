"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { RequireSignIn, StatusChip, errorText } from "@/components/ui";
import { LoanCard } from "@/components/LoanCard";

function Admin() {
  const me = useQuery(api.users.me);
  const isAdmin = me?.role === "admin";
  const loans = useQuery(api.loans.all, isAdmin ? {} : "skip");
  const lenders = useQuery(api.admin.lenders, isAdmin ? {} : "skip");
  const tools = useQuery(api.tools.list, isAdmin ? {} : "skip");
  const setTrusted = useMutation(api.admin.setTrusted);
  const remove = useMutation(api.tools.remove);
  const [error, setError] = useState("");
  if (me === undefined) return <p className="text-sm text-stone-500">Loading…</p>;
  if (!isAdmin) return <p className="card text-sm text-stone-600">This page is for admins.</p>;
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Admin</h1>
      {error && <p className="text-sm text-red-700">{error}</p>}

      <section>
        <h2 className="mb-2 font-medium">Lenders</h2>
        {lenders === undefined && <p className="text-sm text-stone-500">Loading…</p>}
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {lenders?.map((u) => (
            <li key={u._id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span>
                {u.name} <span className="text-stone-400">· {u.listings} listings</span>
                {u.role === "admin" && <span className="chip ml-2 bg-amber-100 text-amber-800">admin</span>}
              </span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={u.trustedLender}
                  onChange={(e) => setTrusted({ userId: u._id, trusted: e.target.checked }).catch((err) => setError(errorText(err)))}
                />
                Trusted Lender
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">All listings</h2>
        {tools === undefined && <p className="text-sm text-stone-500">Loading…</p>}
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {tools?.map((t) => (
            <li key={t._id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span>
                {t.name} <span className="capitalize text-stone-400">· {t.category} · {t.ownerName}</span>
              </span>
              <span className="flex items-center gap-2">
                <StatusChip status={t.status} />
                <button
                  className="btn-danger"
                  onClick={() => {
                    if (confirm(`Remove "${t.name}" for everyone?`)) remove({ toolId: t._id }).catch((err) => setError(errorText(err)));
                  }}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">All loans</h2>
        {loans === undefined ? (
          <p className="text-sm text-stone-500">Loading…</p>
        ) : loans.length === 0 ? (
          <p className="text-sm text-stone-500">No loans yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">{loans.map((l) => <LoanCard key={l._id} loan={l} side="admin" />)}</ul>
        )}
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireSignIn>
      <Admin />
    </RequireSignIn>
  );
}
