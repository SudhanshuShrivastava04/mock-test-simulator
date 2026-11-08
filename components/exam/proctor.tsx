"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera, CheckCircle2, Loader2, MapPin, Mic, MonitorUp, ShieldAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────
// Proctoring: camera + mic, entire-screen share and location. The streams live in this module
// (not in React state) so they survive the soft navigation from the start screen into the exam.
// ─────────────────────────────────────────────────────────────
type Geo = { lat: number; lon: number; acc: number };
const P: { cam: MediaStream | null; screen: MediaStream | null; geo: Geo | null; v: number } = { cam: null, screen: null, geo: null, v: 0 };
const subs = new Set<() => void>();
const emit = () => { P.v++; subs.forEach((f) => f()); };
const live = (s: MediaStream | null) => !!s && s.getTracks().length > 0 && s.getTracks().every((t) => t.readyState === "live");

export function useProctorState() {
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => P.v, () => 0);
  return { camOk: live(P.cam), screenOk: live(P.screen), geo: P.geo, cam: P.cam, screen: P.screen };
}

export const proctorSupported = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!navigator.mediaDevices?.getDisplayMedia && "geolocation" in navigator;

export async function requestCamMic() {
  P.cam?.getTracks().forEach((t) => t.stop());
  const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: true });
  s.getTracks().forEach((t) => t.addEventListener("ended", emit));
  P.cam = s; emit();
}

export async function requestScreen() {
  P.screen?.getTracks().forEach((t) => t.stop());
  const s = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "monitor" },
    audio: false,
    // Chrome hints: offer whole screens first, don't offer this tab
    ...({ monitorTypeSurfaces: "include", selfBrowserSurface: "exclude", surfaceSwitching: "exclude" } as object),
  } as DisplayMediaStreamOptions);
  const surface = s.getVideoTracks()[0]?.getSettings().displaySurface;
  if (surface && surface !== "monitor") {
    s.getTracks().forEach((t) => t.stop());
    throw new Error("Please share your entire screen, not a window or a tab.");
  }
  s.getTracks().forEach((t) => t.addEventListener("ended", emit));
  P.screen = s; emit();
}

export function requestGeo() {
  return new Promise<void>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (p) => { P.geo = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }; emit(); resolve(); },
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? "Location permission was denied." : "Couldn't get your location. Try again.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    ),
  );
}

export function stopProctoring() {
  P.cam?.getTracks().forEach((t) => t.stop());
  P.screen?.getTracks().forEach((t) => t.stop());
  P.cam = P.screen = null; emit();
}

const friendly = (e: unknown) => {
  const err = e as DOMException;
  if (err?.name === "NotAllowedError") return "Permission was blocked. Allow it in the browser's address bar (site settings), then try again.";
  if (err?.name === "NotFoundError") return "No camera or microphone was found.";
  if (err?.name === "NotReadableError") return "The camera is busy in another app. Close it and try again.";
  return err?.message || "Something went wrong. Try again.";
};

// ── one permission row ──
function Row({ icon: Icon, title, text, ok, onAllow }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string; ok: boolean; onAllow: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 sm:flex-nowrap">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", ok ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{err ? <span className="text-destructive">{err}</span> : text}</div>
      </div>
      {ok ? (
        <span className="flex items-center gap-1 text-sm font-medium text-success"><CheckCircle2 className="size-4" />Allowed</span>
      ) : (
        <Button size="sm" type="button" disabled={busy} className="max-sm:w-full"
          onClick={async () => { setBusy(true); setErr(""); try { await onAllow(); } catch (e) { setErr(friendly(e)); } finally { setBusy(false); } }}>
          {busy && <Loader2 className="animate-spin" />}Allow
        </Button>
      )}
    </div>
  );
}

/** Start screen: collect all permissions, then enable the Begin button (a form posting to startAttempt). */
export function ProctorGate({ action, email }: { action: (fd: FormData) => void; email: string }) {
  const s = useProctorState();
  const [consent, setConsent] = useState(false);
  // server render assumes support; the browser corrects it after hydration (no mismatch)
  const supported = useSyncExternalStore(() => () => {}, proctorSupported, () => true);
  const preview = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (preview.current && s.cam) preview.current.srcObject = s.cam; }, [s.cam]);
  const ready = s.camOk && s.screenOk && !!s.geo && consent;

  if (!supported) {
    return (
      <div className="flex gap-3 rounded-xl border border-warning bg-warning-soft p-4 text-sm">
        <ShieldAlert className="size-5 shrink-0 text-warning" />
        <div>
          <b>This test is proctored and needs a laptop or desktop.</b> Open the link in Chrome, Edge or Firefox on a computer.
          Phones and tablets can&apos;t share their screen from the browser.
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="lat" value={s.geo?.lat ?? ""} />
      <input type="hidden" name="lon" value={s.geo?.lon ?? ""} />
      <input type="hidden" name="acc" value={s.geo?.acc ?? ""} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-2.5">
          <Row icon={Camera} title="Camera and microphone" text="Snapshots every minute; the microphone flags sustained talking. Nothing is recorded continuously." ok={s.camOk} onAllow={requestCamMic} />
          <Row icon={MonitorUp} title="Share your entire screen" text="Pick “Entire screen” in the browser dialog. A low-res screenshot is saved every few minutes." ok={s.screenOk} onAllow={requestScreen} />
          <Row icon={MapPin} title="Location" text="Recorded once, when you begin." ok={!!s.geo} onAllow={requestGeo} />
        </div>
        <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted lg:aspect-auto">
          {s.camOk ? <video ref={preview} autoPlay muted playsInline className="size-full scale-x-[-1] object-cover" />
            : <div className="grid size-full place-items-center p-4 text-center text-xs text-muted-foreground"><Camera className="mx-auto mb-1 size-6" />Camera preview</div>}
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I agree to camera, microphone, screen and location monitoring during this test. My teacher can review the snapshots and events.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3 border-t pt-5">
        <Button type="submit" size="lg" disabled={!ready} className="max-sm:w-full">Begin test</Button>
        <span className="text-sm text-muted-foreground">{ready ? `Signed in as ${email}` : "Allow all three and tick the box to begin."}</span>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// During the exam: keep the streams alive, take snapshots, report events.
// ─────────────────────────────────────────────────────────────
const CAM_EVERY = 60_000, SCREEN_EVERY = 180_000;

function post(body: object) {
  return fetch("/api/proctor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: JSON.stringify(body).length < 60_000 }).catch(() => {});
}

function grab(stream: MediaStream, width: number, quality: number): Promise<string | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.srcObject = stream;
    v.onloadeddata = () => {
      const w = Math.min(width, v.videoWidth || width);
      const h = Math.round(w * ((v.videoHeight || 3) / (v.videoWidth || 4)));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(v, 0, 0, w, h);
      v.srcObject = null;
      resolve(c.toDataURL("image/jpeg", quality));
    };
    v.onerror = () => resolve(null);
    v.play().catch(() => resolve(null));
  });
}

export function ProctorMonitor({ assessmentId }: { assessmentId: string }) {
  const s = useProctorState();
  const self = useRef<HTMLVideoElement>(null);
  const report = (kind: string, detail?: string) => post({ type: "event", assessmentId, kind, detail });

  useEffect(() => { if (self.current && s.cam) self.current.srcObject = s.cam; }, [s.cam]);

  // lost streams are reported once each time they drop (also when the page reloads without them)
  const prev = useRef({ cam: true, screen: true });
  useEffect(() => {
    if (prev.current.cam && !s.camOk) report("camera_off", "Camera or microphone stopped");
    if (prev.current.screen && !s.screenOk) report("screen_off", "Screen sharing stopped");
    if (!prev.current.cam && s.camOk) report("camera_on");
    if (!prev.current.screen && s.screenOk) report("screen_on");
    prev.current = { cam: s.camOk, screen: s.screenOk };
  });

  // snapshots
  useEffect(() => {
    const shoot = async (kind: "cam" | "screen") => {
      const stream = kind === "cam" ? P.cam : P.screen;
      if (!live(stream)) return;
      const data = await grab(stream!, kind === "cam" ? 320 : 960, kind === "cam" ? 0.55 : 0.5);
      if (data) post({ type: "shot", assessmentId, kind, data });
    };
    const first = setTimeout(() => { shoot("cam"); shoot("screen"); }, 4000);
    const a = setInterval(() => shoot("cam"), CAM_EVERY);
    const b = setInterval(() => shoot("screen"), SCREEN_EVERY);
    return () => { clearTimeout(first); clearInterval(a); clearInterval(b); };
  }, [assessmentId]);

  // focus, tab, multi-monitor and paste signals
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) { hiddenAt = Date.now(); report("tab_hidden", "Left the test tab"); }
      else if (hiddenAt) report("tab_back", `Came back after ${Math.round((Date.now() - hiddenAt) / 1000)} s`);
    };
    const onBlur = () => setTimeout(() => { if (!document.hidden) report("window_blur", "Test window lost focus (another app or window)"); }, 300);
    const onPaste = (e: ClipboardEvent) => {
      const n = e.clipboardData?.getData("text")?.length || 0;
      if (n > 80) report("paste", `Pasted ${n} characters`);
    };
    const scr = window.screen as Screen & { isExtended?: boolean };
    if (scr.isExtended) report("extended_display", "A second monitor is connected");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("paste", onPaste, true);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("paste", onPaste, true);
    };
  }, [assessmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // sustained sound on the mic (talking to someone) — level only, no audio is recorded
  useEffect(() => {
    if (!s.cam?.getAudioTracks().length) return;
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(s.cam);
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    let loud = 0, lastReport = 0;
    const id = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((t, x) => t + x * x, 0) / buf.length);
      loud = rms > 0.06 ? loud + 1 : Math.max(0, loud - 1);
      if (loud >= 8 && Date.now() - lastReport > 120_000) { lastReport = Date.now(); loud = 0; report("noise", "Sustained sound or talking picked up by the microphone"); }
    }, 500);
    return () => { clearInterval(id); ctx.close().catch(() => {}); };
  }, [s.cam]); // eslint-disable-line react-hooks/exhaustive-deps

  const paused = !s.camOk || !s.screenOk;
  return (
    <>
      {/* self-view, so the student knows monitoring is on */}
      <div className="pointer-events-none fixed right-3 bottom-3 z-40 hidden w-36 overflow-hidden rounded-lg border-2 border-background bg-black shadow-lg sm:block">
        {s.camOk && <video ref={self} autoPlay muted playsInline className="aspect-[4/3] w-full scale-x-[-1] object-cover" />}
        <div className="flex items-center gap-1 bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
          <span className={cn("size-1.5 rounded-full", paused ? "bg-destructive" : "bg-success")} />{paused ? "Monitoring paused" : "Monitoring on"}
        </div>
      </div>
      {paused && <Paused camOk={s.camOk} screenOk={s.screenOk} />}
    </>
  );
}

/** Blocks the test until camera and screen sharing are back. The timer keeps running. */
function Paused({ camOk, screenOk }: { camOk: boolean; screenOk: boolean }) {
  const [err, setErr] = useState("");
  const fix = async (fn: () => Promise<void>) => { setErr(""); try { await fn(); } catch (e) { setErr(friendly(e)); } };
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="paused-title" className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <ShieldAlert className="mb-3 size-8 text-destructive" />
        <h2 id="paused-title" className="text-lg font-semibold">Monitoring stopped</h2>
        <p className="mt-1 text-sm text-muted-foreground">Turn these back on to continue. Your answers are safe, but the timer keeps running.</p>
        <div className="mt-4 grid gap-2">
          {!camOk && <Button onClick={() => fix(requestCamMic)}><Camera />Turn camera and microphone back on</Button>}
          {!screenOk && <Button onClick={() => fix(requestScreen)}><MonitorUp />Share your entire screen again</Button>}
          {camOk && <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" />Camera and microphone on</p>}
          {screenOk && <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" />Screen shared</p>}
        </div>
        {err && <p className="mt-3 flex items-start gap-1.5 text-sm text-destructive"><XCircle className="mt-0.5 size-4 shrink-0" />{err}</p>}
        <p className="mt-4 text-xs text-muted-foreground"><Mic className="mr-1 inline size-3" />This pause is logged for your teacher.</p>
      </div>
    </div>
  );
}
