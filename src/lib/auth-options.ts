import type { BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";

const appBaseUrl =
  process.env.BETTER_AUTH_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

export function buildAuthOptions() {
  return {
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: appBaseUrl,
    emailAndPassword: {
      enabled: true,
    },
    plugins: [admin()],
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "user",
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },
    trustedOrigins: [
      appBaseUrl,
    ],
  } satisfies Omit<BetterAuthOptions, "database">;
}
