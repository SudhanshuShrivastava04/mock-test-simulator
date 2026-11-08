import { AlertTriangle, Camera, MapPin, MonitorUp, ShieldCheck } from "lucide-react";
import { getProctor, proctorBase, type ProctorEvent } from "@/lib/data";
import type { Submission } from "@/lib/types";
import { fmtDate } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Admin view of what was recorded while the student took the test.
const LABEL: Record<string, string> = {
  consent: "Agreed to monitoring",
  location: "Location recorded",
  tab_hidden: "Left the test tab",
  tab_back: "Came back to the tab",
  window_blur: "Switched to another window",
  camera_off: "Camera / mic stopped",
  camera_on: "Camera back on",
  screen_off: "Screen sharing stopped",
  screen_on: "Screen sharing back on",
  extended_display: "Second monitor connected",
  noise: "Sustained talking / noise",
  paste: "Large paste",
};
const SERIOUS = new Set(["tab_hidden", "window_blur", "camera_off", "screen_off", "extended_display", "noise", "paste"]);

const time = (t: number) =>
  new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata" });

export async function ProctorPanel({ sub }: { sub: Submission }) {
  if (!sub.email) return null;
  const base = proctorBase(sub.assessmentId!, sub.email, sub.startedAt);
  const { events, shots } = await getProctor(base);
  if (!events.length && !shots.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" />Proctoring</CardTitle>
          <CardDescription>Nothing recorded for this attempt (proctoring was off, or it was taken before proctoring existed).</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const loc = events.find((e) => e.kind === "location");
  const geo = loc?.detail ? (JSON.parse(loc.detail) as { lat: number; lon: number; acc: number }) : null;
  const flagged = events.filter((e) => SERIOUS.has(e.kind));
  const counts = flagged.reduce<Record<string, number>>((m, e) => ((m[e.kind] = (m[e.kind] || 0) + 1), m), {});
  const cams = shots.map((s, i) => ({ ...s, i })).filter((s) => s.kind === "cam");
  const screens = shots.map((s, i) => ({ ...s, i })).filter((s) => s.kind === "screen");
  const src = (i: number) => `/api/proctor/shot?b=${encodeURIComponent(base)}&i=${i}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" />Proctoring</CardTitle>
        <CardDescription className="flex flex-wrap gap-1.5 pt-1">
          {flagged.length === 0
            ? <Badge className="border-0 bg-success-soft text-success">No flags</Badge>
            : Object.entries(counts).map(([k, n]) => <Badge key={k} className="border-0 bg-warning-soft text-warning">{LABEL[k] || k} × {n}</Badge>)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {geo && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <MapPin className="size-4 text-muted-foreground" />
            Started at {geo.lat.toFixed(4)}, {geo.lon.toFixed(4)} (±{Math.round(geo.acc)} m)
            <a className="text-primary hover:underline" target="_blank" rel="noopener" href={`https://www.google.com/maps?q=${geo.lat},${geo.lon}`}>Open map</a>
          </p>
        )}

        <Gallery title="Camera" icon={Camera} items={cams} src={src} ratio="aspect-[4/3]" />
        <Gallery title="Screen" icon={MonitorUp} items={screens} src={src} ratio="aspect-video" />

        <div>
          <h3 className="mb-2 text-sm font-semibold">Timeline</h3>
          <ol className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border p-2 text-sm">
            {events.map((e: ProctorEvent, k) => (
              <li key={k} className="flex gap-3 rounded px-1.5 py-1 odd:bg-muted/40">
                <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{time(e.t)}</span>
                <span className={SERIOUS.has(e.kind) ? "font-medium text-warning" : ""}>
                  {SERIOUS.has(e.kind) && <AlertTriangle className="mr-1 inline size-3.5" />}
                  {LABEL[e.kind] || e.kind}
                  {e.detail && e.kind !== "location" && <span className="font-normal text-muted-foreground"> · {e.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-1 text-xs text-muted-foreground">Started {fmtDate(sub.startedAt)}. Evidence is kept for 90 days.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Gallery({ title, icon: Icon, items, src, ratio }: { title: string; icon: React.ComponentType<{ className?: string }>; items: { t: number; i: number }[]; src: (i: number) => string; ratio: string }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Icon className="size-4" />{title} <span className="font-normal text-muted-foreground">({items.length})</span></h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((s) => (
          <a key={s.i} href={src(s.i)} target="_blank" rel="noopener" className="group overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked images */}
            <img src={src(s.i)} alt={`${title} at ${time(s.t)}`} loading="lazy" className={`${ratio} w-full object-cover transition-opacity group-hover:opacity-90`} />
            <span className="block px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{time(s.t)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
