import "server-only";

const list = (v: string | undefined) =>
  (v || "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** Google accounts that get the admin (teacher) role. Comma-separated. */
export const ADMIN_EMAILS = list(process.env.ADMIN_EMAILS);

/**
 * Local-only "sign in as any email" button, so both roles can be tried without Google keys.
 * It can never turn on in a production build.
 */
export const DEV_LOGIN = process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "1";

export const GOOGLE_CONFIGURED = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

/** Public base URL used in invite emails. */
export function appUrl() {
  const explicit = process.env.APP_URL || process.env.AUTH_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
