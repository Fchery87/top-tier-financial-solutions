import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { twoFactor } from "better-auth/plugins/two-factor";
import { isMfaRequiredForRole } from "./mfa";

export const TWO_FACTOR_ISSUER = "Top Tier Financial Solutions";

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
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "user",
          input: false,
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
    plugins: [
      twoFactor({
        issuer: TWO_FACTOR_ISSUER,
        // Backup codes stay on the plugin default: generated server-side and
        // stored encrypted with the auth secret. TOTP secrets are always
        // encrypted by the plugin. No SMS/email OTP: sendOTP is not configured.
      }),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/two-factor/verify-totp" || ctx.path === "/two-factor/verify-backup-code") {
          // No trusted devices: every sign-in asks for the second factor.
          // Enforced here so a hand-built request cannot opt in.
          if (ctx.body) ctx.body.trustDevice = false;
          return;
        }
        if (ctx.path !== "/two-factor/disable") return;
        // MFA is required for team roles, so they may never turn it off.
        // Read the role from the database, not the session cookie cache.
        const session = await getSessionFromCtx(ctx);
        if (!session) return;
        const freshUser = await ctx.context.internalAdapter.findUserById(session.user.id);
        const role = (freshUser as { role?: unknown } | null)?.role;
        if (isMfaRequiredForRole(role)) {
          throw APIError.from("FORBIDDEN", {
            code: "MFA_REQUIRED_FOR_ROLE",
            message: "Two-factor authentication is required for team accounts and cannot be turned off.",
          });
        }
      }),
    },
  } satisfies Omit<BetterAuthOptions, "database">;
}
