import { CONFIG, SET2, gradeSet1 } from "../lib/questions.js";
import { saveSubmission } from "../lib/store.js";
import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const name = String(body.name || "").trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: "Name is missing." });

    const set1 = gradeSet1(body.answers || {});

    const LANGS = ["python", "java", "cpp", "mysql", "spark"];
    const num = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
    const set2 = SET2.map((q) => {
      const a = {
        id: q.id,
        answer: String((body.set2 || {})[q.id] || "").slice(0, 20000),
        marks: null,     // you fill this in from the admin page
        note: ""
      };
      const c = q.coding && (body.coding || {})[q.id];
      if (c) {
        // what the candidate's own browser reported; re-run it from the admin page to confirm
        a.lang = LANGS.includes(c.lang) ? c.lang : null;
        const s = c.submit;
        a.run = s ? {
          passed: num(s.passed, q.coding.tests.length),
          total: q.coding.tests.length,
          at: Number(s.at) || null,
          lang: LANGS.includes(s.lang) ? s.lang : null,
          stale: !!s.stale
        } : null;
      }
      return a;
    });

    const now = Date.now();
    const startedAt = Number(body.startedAt) || now;

    const submission = {
      id: crypto.randomUUID(),
      name,
      startedAt,
      submittedAt: now,
      timeTakenSec: Math.max(0, Math.round((now - startedAt) / 1000)),
      autoSubmitted: !!body.autoSubmitted,
      tabSwitches: Number(body.tabSwitches) || 0,
      set1,
      set2
    };

    await saveSubmission(submission);

    const reply = { ok: true };
    if (CONFIG.showScoreToCandidate) reply.score = { set1: set1.score, max: set1.max };
    res.status(200).json(reply);
  } catch (e) {
    res.status(500).json({ error: e.message || "Could not save the submission." });
  }
}
