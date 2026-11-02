// Convex verifies Clerk's session token directly (RS256, Clerk's public JWKS).
// CLERK_JWT_ISSUER_DOMAIN is the Clerk Frontend API URL, e.g. https://your-app.clerk.accounts.dev
const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;

const authConfig = {
  providers: issuer
    ? [
        {
          type: "customJwt" as const,
          issuer,
          jwks: `${issuer}/.well-known/jwks.json`,
          algorithm: "RS256" as const,
        },
      ]
    : [],
};

export default authConfig;
