"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function Nav() {
  const { isSignedIn } = useAuth();
  const me = useQuery(api.users.me, isSignedIn ? {} : "skip");
  const path = usePathname();
  const links = [
    { href: "/tools", label: "All tools" },
    { href: "/listings", label: "My listings" },
    { href: "/requests", label: "Requests" },
    ...(me?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-emerald-800">
          LendLoop
        </Link>
        {isSignedIn && (
          <nav className="flex flex-wrap gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-2.5 py-1 ${path.startsWith(l.href) ? "bg-emerald-50 font-medium text-emerald-800" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          {me?.role === "admin" && <span className="chip bg-amber-100 text-amber-800">admin</span>}
          {isSignedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <button className="btn-primary">Sign in</button>
            </SignInButton>
          )}
        </div>
      </div>
    </header>
  );
}
