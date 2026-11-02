"use client";

import Link from "next/link";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Home() {
  const { isSignedIn } = useAuth();
  const tools = useQuery(api.tools.listPublic);
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-emerald-800 px-6 py-10 text-white">
        <p className="text-sm uppercase tracking-widest text-emerald-200">LendLoop</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Borrow what you need. Lend what you don&apos;t.</h1>
        <p className="mt-3 max-w-xl text-emerald-100">
          A neighborhood board for tools. List the drill in your garage, borrow a ladder for the weekend, and get reminders
          so everything comes back.
        </p>
        <div className="mt-6">
          {isSignedIn ? (
            <Link href="/tools" className="btn-ghost text-stone-900">
              Open the board
            </Link>
          ) : (
            <SignInButton mode="modal">
              <button className="btn-ghost text-stone-900">Sign in to lend or borrow</button>
            </SignInButton>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Available right now</h2>
        {tools === undefined ? (
          <p className="text-sm text-stone-500">Loading…</p>
        ) : tools.length === 0 ? (
          <p className="card text-sm text-stone-500">No tools listed yet. Be the first to lend one.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <li key={t._id} className="card">
                <p className="font-medium">{t.name}</p>
                <p className="text-sm capitalize text-stone-500">{t.category}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
