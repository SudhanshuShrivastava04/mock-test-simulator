import "server-only";
import fs from "node:fs";
import path from "node:path";

// Upstash Redis over its REST API. Every request is a plain HTTPS call, so any number of
// serverless instances can serve traffic at once with no connection pool to exhaust.
// Without Upstash env vars (local dev only) a small file-backed store stands in.

type Cmd = (string | number)[];
type Result = unknown;

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function upstash(cmds: Cmd[]): Promise<Result[]> {
  const r = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Database error (${r.status})`);
  const out = (await r.json()) as { result?: Result; error?: string }[];
  return out.map((x) => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

// ── local dev store ──
type Mem = { h: Record<string, Record<string, string>>; s: Record<string, string[]> };
const FILE = path.join(process.cwd(), ".data", "dev-db.json");
const g = globalThis as unknown as { __mem?: Mem };

function mem(): Mem {
  if (!g.__mem) {
    try {
      g.__mem = JSON.parse(fs.readFileSync(FILE, "utf8"));
    } catch {
      g.__mem = { h: {}, s: {} };
    }
  }
  return g.__mem!;
}
function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(g.__mem));
}

function local(cmds: Cmd[]): Result[] {
  const m = mem();
  let dirty = false;
  const res = cmds.map(([op, key, ...a]) => {
    const k = String(key);
    const h = (m.h[k] ||= {});
    const s = new Set(m.s[k] || []);
    switch (String(op).toUpperCase()) {
      case "HGET": return h[String(a[0])] ?? null;
      case "HMGET": return a.map((f) => h[String(f)] ?? null);
      case "HGETALL": return Object.entries(h).flat();
      case "HSET": for (let i = 0; i < a.length; i += 2) h[String(a[i])] = String(a[i + 1]); dirty = true; return a.length / 2;
      case "HSETNX": if (String(a[0]) in h) return 0; h[String(a[0])] = String(a[1]); dirty = true; return 1;
      case "HDEL": a.forEach((f) => delete h[String(f)]); dirty = true; return a.length;
      case "HLEN": return Object.keys(h).length;
      case "SADD": a.forEach((v) => s.add(String(v))); m.s[k] = [...s]; dirty = true; return a.length;
      case "SREM": a.forEach((v) => s.delete(String(v))); m.s[k] = [...s]; dirty = true; return a.length;
      case "SMEMBERS": return [...s];
      case "DEL": delete m.h[k]; delete m.s[k]; dirty = true; return 1;
      default: throw new Error(`dev store: ${op} not supported`);
    }
  });
  if (dirty) persist();
  return res;
}

const useUpstash = !!(URL_ && TOKEN);

/** Run several commands in one round trip. */
export async function pipe(cmds: Cmd[]): Promise<Result[]> {
  if (!cmds.length) return [];
  if (useUpstash) return upstash(cmds);
  if (process.env.NODE_ENV === "production") {
    throw new Error("Database not connected. Add Upstash Redis to this project in Vercel → Storage, then redeploy.");
  }
  return local(cmds);
}

export async function cmd<T = Result>(...c: Cmd): Promise<T> {
  return (await pipe([c]))[0] as T;
}

export const parse = <T>(raw: unknown): T | null => {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/** HGETALL's flat [field, value, field, value…] reply → parsed values. */
export function values<T>(flat: unknown): T[] {
  const a = (flat as string[]) || [];
  const out: T[] = [];
  for (let i = 1; i < a.length; i += 2) {
    const v = parse<T>(a[i]);
    if (v) out.push(v);
  }
  return out;
}
