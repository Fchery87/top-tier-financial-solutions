"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

// The sign-in page handles the `twoFactorRedirect` response itself (so it can
// carry the `next` parameter), so no automatic redirect is configured here.
export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession, getSession, twoFactor } = authClient;
