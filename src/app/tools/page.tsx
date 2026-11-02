"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CATEGORIES } from "../../../convex/constants";
import { RequireSignIn, StatusChip, errorText } from "@/components/ui";

const isoToday = () => new Date().toISOString().slice(0, 10);

function BorrowForm({ toolId, onDone }: { toolId: Id<"tools">; onDone: (sent: boolean) => void }) {
  const request = useMutation(api.loans.request);
  const [start, setStart] = useState(isoToday());
  const [end, setEnd] = useState(isoToday());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request({ toolId, startDate: start, endDate: end });
      onDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3">
      <label>
        <span className="label">From</span>
        <input type="date" className="input" value={start} min={isoToday()} onChange={(e) => setStart(e.target.value)} required />
      </label>
      <label>
        <span className="label">Until</span>
        <input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
      </label>
      {error && <p className="col-span-2 text-sm text-red-700">{error}</p>}
      <div className="col-span-2 flex gap-2">
        <button className="btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send request"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => onDone(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Board() {
  const [category, setCategory] = useState<string>("");
  const tools = useQuery(api.tools.list, category ? { category } : {});
  const [open, setOpen] = useState<Id<"tools"> | null>(null);
  const [sent, setSent] = useState<Id<"tools"> | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">All tools</h1>
        <div className="flex flex-wrap gap-1">
          {["", ...CATEGORIES].map((c) => (
            <button
              key={c || "all"}
              onClick={() => setCategory(c)}
              className={`chip border px-3 py-1 capitalize ${category === c ? "border-emerald-700 bg-emerald-700 text-white" : "border-stone-300 bg-white text-stone-700"}`}
            >
              {c || "all"}
            </button>
          ))}
        </div>
      </div>
      {tools === undefined ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : tools.length === 0 ? (
        <p className="card text-sm text-stone-500">No tools in this category yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tools.map((t) => (
            <li key={t._id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm capitalize text-stone-500">
                    {t.category} · {t.condition}
                  </p>
                </div>
                <StatusChip status={t.status} />
              </div>
              {t.description && <p className="mt-2 text-sm text-stone-700">{t.description}</p>}
              <p className="mt-2 text-xs text-stone-500">
                Lent by {t.mine ? "you" : t.ownerName}
                {t.ownerTrusted && <span className="chip ml-2 bg-emerald-50 text-emerald-800">Trusted Lender</span>}
              </p>
              {!t.mine &&
                (open === t._id ? (
                  <BorrowForm
                    toolId={t._id}
                    onDone={(ok) => {
                      setOpen(null);
                      if (ok) setSent(t._id);
                    }}
                  />
                ) : (
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setOpen(t._id);
                        setSent(null);
                      }}
                    >
                      Request to borrow
                    </button>
                    {sent === t._id && <span className="text-sm text-emerald-700">Request sent</span>}
                  </div>
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ToolsPage() {
  return (
    <RequireSignIn>
      <Board />
    </RequireSignIn>
  );
}
