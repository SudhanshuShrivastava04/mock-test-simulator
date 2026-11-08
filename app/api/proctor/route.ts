import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/session";
import { addProctorEvent, addProctorShot, getAssessment, getAttempt, proctorBase, tryLock } from "@/lib/data";

// The exam page reports proctoring events (tab switches, screen share stopped, noise…) and
// periodic low-resolution camera / screen snapshots here, for the admin to review later.
const Event = z.object({ type: z.literal("event"), assessmentId: z.string().max(120), kind: z.string().max(40), detail: z.string().max(300).optional() });
const Shot = z.object({
  type: z.literal("shot"),
  assessmentId: z.string().max(120),
  kind: z.enum(["cam", "screen"]),
  data: z.string().max(400_000).regex(/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
});
const Body = z.discriminatedUnion("type", [Event, Shot]);

export async function POST(req: Request) {
  const v = await getViewer();
  if (v?.role !== "student") return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const b = parsed.data;
  const [a, t] = await Promise.all([getAssessment(b.assessmentId), getAttempt(b.assessmentId, v.email)]);
  if (!a || !t?.startedAt || t.submittedAt) return NextResponse.json({ error: "No active attempt." }, { status: 403 });
  const base = proctorBase(a.id, v.email, t.startedAt);

  if (b.type === "event") {
    // at most one event of each kind per 5 seconds, so a flapping browser can't flood storage
    if (!(await tryLock(`pev:${base}:${b.kind}`, 5))) return NextResponse.json({ ok: true, throttled: true });
    await addProctorEvent(base, { t: Date.now(), kind: b.kind, detail: b.detail });
    return NextResponse.json({ ok: true });
  }
  if (a.proctoring === false) return NextResponse.json({ ok: true, ignored: true });
  if (!(await tryLock(`pshot:${base}:${b.kind}`, 20))) return NextResponse.json({ ok: true, throttled: true });
  await addProctorShot(base, { t: Date.now(), kind: b.kind }, b.data);
  return NextResponse.json({ ok: true });
}
