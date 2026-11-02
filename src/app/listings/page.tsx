"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { CATEGORIES, CONDITIONS } from "../../../convex/constants";
import { RequireSignIn, StatusChip, errorText } from "@/components/ui";

type Fields = { name: string; category: string; condition: string; description: string };
const EMPTY: Fields = { name: "", category: CATEGORIES[0], condition: "good", description: "" };

function ToolForm({ initial, onSave, onCancel }: { initial: Fields; onSave: (f: Fields) => Promise<void>; onCancel?: () => void }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(f);
      if (!onCancel) setF(EMPTY);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="label">Name</span>
        <input className="input" value={f.name} maxLength={60} required onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Cordless drill" />
      </label>
      <label>
        <span className="label">Category</span>
        <select className="input capitalize" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Condition</span>
        <select className="input capitalize" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>
          {CONDITIONS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="label">Short description</span>
        <textarea className="input" rows={2} maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Two batteries included. Please return charged." />
      </label>
      {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : onCancel ? "Save changes" : "List tool"}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Row({ tool }: { tool: Doc<"tools"> & { status: string } }) {
  const update = useMutation(api.tools.update);
  const remove = useMutation(api.tools.remove);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  if (editing) {
    return (
      <li className="card">
        <ToolForm
          initial={{ name: tool.name, category: tool.category, condition: tool.condition, description: tool.description }}
          onSave={async (f) => {
            await update({ toolId: tool._id as Id<"tools">, ...f });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{tool.name}</p>
          <p className="text-sm capitalize text-stone-500">
            {tool.category} · {tool.condition}
          </p>
        </div>
        <StatusChip status={tool.status} />
      </div>
      {tool.description && <p className="mt-2 text-sm text-stone-700">{tool.description}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button className="btn-ghost" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="btn-danger"
          onClick={async () => {
            if (!confirm(`Delete "${tool.name}"?`)) return;
            try {
              await remove({ toolId: tool._id });
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function Listings() {
  const tools = useQuery(api.tools.mine);
  const create = useMutation(api.tools.create);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My listings</h1>
      <section className="card">
        <h2 className="mb-3 font-medium">Lend a tool</h2>
        <ToolForm
          initial={EMPTY}
          onSave={async (f) => {
            await create(f);
          }}
        />
      </section>
      {tools === undefined ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : tools.length === 0 ? (
        <p className="text-sm text-stone-500">You have not listed anything yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tools.map((t) => (
            <Row key={t._id} tool={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ListingsPage() {
  return (
    <RequireSignIn>
      <Listings />
    </RequireSignIn>
  );
}
