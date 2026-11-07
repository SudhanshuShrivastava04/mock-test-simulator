import { CONFIG, SET1, SET2 } from "../lib/questions.js";
import { listSubmissions, getSubmission, saveSubmission, deleteSubmission } from "../lib/store.js";

function authorised(req) {
  const pw = process.env.ADMIN_PASSWORD;
  return pw && req.headers["x-admin-password"] === pw;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ADMIN_PASSWORD is not set in Vercel environment variables." });
  }
  if (!authorised(req)) return res.status(401).json({ error: "Wrong password." });

  try {
    if (req.method === "GET") {
      const submissions = await listSubmissions();
      return res.status(200).json({ config: CONFIG, set1: SET1, set2: SET2, submissions });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    if (req.method === "POST" && body.action === "grade") {
      const sub = await getSubmission(body.id);
      if (!sub) return res.status(404).json({ error: "Submission not found." });
      const grades = body.grades || {};
      sub.set2 = sub.set2.map((a) => {
        const g = grades[a.id];
        if (!g) return a;
        const max = (SET2.find((q) => q.id === a.id) || {}).marks ?? 0;
        let m = g.marks === "" || g.marks === null || g.marks === undefined ? null : Number(g.marks);
        if (m !== null && (Number.isNaN(m) || m < 0)) m = 0;
        if (m !== null && m > max) m = max;
        return { ...a, marks: m, note: String(g.note || "").slice(0, 2000) };
      });
      await saveSubmission(sub);
      return res.status(200).json({ ok: true, submission: sub });
    }

    if (req.method === "POST" && body.action === "delete") {
      await deleteSubmission(body.id);
      return res.status(200).json({ ok: true });
    }

    res.status(400).json({ error: "Unknown action." });
  } catch (e) {
    res.status(500).json({ error: e.message || "Something went wrong." });
  }
}
