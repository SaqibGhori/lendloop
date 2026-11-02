"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { ConvexProviderWithAuth, ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/** Hands Clerk's standard session token to Convex (verified there against Clerk's JWKS). */
function useClerkForConvex() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        return await getToken({ skipCache: forceRefreshToken });
      } catch {
        return null;
      }
    },
    [getToken],
  );
  return useMemo(
    () => ({ isLoading: !isLoaded, isAuthenticated: isSignedIn ?? false, fetchAccessToken }),
    [isLoaded, isSignedIn, fetchAccessToken],
  );
}

/** Creates or refreshes the Convex user row once per sign-in. */
function EnsureUser() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const ensure = useMutation(api.users.ensure);
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !user || done.current === user.id) return;
    done.current = user.id;
    const name = user.fullName || user.username || user.firstName || "Neighbor";
    ensure({ name }).catch(() => {
      done.current = null;
    });
  }, [isAuthenticated, user, ensure]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useClerkForConvex}>
      <EnsureUser />
      {children}
    </ConvexProviderWithAuth>
  );
}
