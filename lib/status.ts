import type { Assessment, Attempt } from "@/lib/types";

/** Grace period after the timer ends, for a slow network on auto-submit. */
export const GRACE_MS = 2 * 60_000;

export function windowState(a: Pick<Assessment, "opensAt" | "closesAt" | "archived">, now = Date.now()) {
  if (a.archived) return "closed" as const;
  if (a.opensAt && now < a.opensAt) return "upcoming" as const;
  if (a.closesAt && now > a.closesAt) return "closed" as const;
  return "open" as const;
}

export type AttemptState = "invited" | "in_progress" | "submitted" | "missed";

export function attemptState(t: Attempt, a: Assessment, now = Date.now()): AttemptState {
  if (t.submittedAt) return "submitted";
  if (t.startedAt) return "in_progress";
  return windowState(a, now) === "closed" ? "missed" : "invited";
}

export const deadlineOf = (t: Attempt, a: Assessment) =>
  t.startedAt ? t.startedAt + a.durationMinutes * 60_000 : null;

export const STATE_LABEL: Record<AttemptState, string> = {
  invited: "Invited",
  in_progress: "In progress",
  submitted: "Submitted",
  missed: "Missed",
};

export function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${sec % 60}s`;
}

export const LANG_LABEL: Record<string, string> = {
  python: "Python 3",
  java: "Java 8",
  cpp: "C++17",
  mysql: "MySQL",
  spark: "Spark SQL",
};

const TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata";

export function fmtWindow(a: Pick<Assessment, "opensAt" | "closesAt">) {
  const f = (t: number) => new Date(t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: TZ });
  if (a.opensAt && a.closesAt) return `${f(a.opensAt)} to ${f(a.closesAt)}`;
  if (a.opensAt) return `from ${f(a.opensAt)}`;
  if (a.closesAt) return `until ${f(a.closesAt)}`;
  return "any time";
}
