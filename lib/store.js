// Tiny Upstash Redis REST client (no npm packages needed).
// Works with the env vars Vercel adds when you connect Upstash Redis
// from the Vercel Marketplace (KV_REST_API_* or UPSTASH_REDIS_REST_*).

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const HASH = "submissions";

async function redis(command) {
  if (!URL_ || !TOKEN) {
    throw new Error("Database not connected. Add Upstash Redis to this project in Vercel → Storage, then redeploy.");
  }
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export async function saveSubmission(sub) {
  await redis(["HSET", HASH, sub.id, JSON.stringify(sub)]);
}

export async function getSubmission(id) {
  const raw = await redis(["HGET", HASH, id]);
  return raw ? JSON.parse(raw) : null;
}

export async function listSubmissions() {
  const flat = (await redis(["HGETALL", HASH])) || [];
  const out = [];
  for (let i = 1; i < flat.length; i += 2) {
    try { out.push(JSON.parse(flat[i])); } catch {}
  }
  return out.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
}

export async function deleteSubmission(id) {
  await redis(["HDEL", HASH, id]);
}
