import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { getProctorShot } from "@/lib/data";

// Admin-only: one stored snapshot as an image. ?b=<proctor base>&i=<index>
export async function GET(req: Request) {
  const v = await getViewer();
  if (v?.role !== "admin") return new NextResponse("Not allowed", { status: 403 });
  const u = new URL(req.url);
  const base = u.searchParams.get("b") || "";
  const i = Number(u.searchParams.get("i"));
  if (!/^pr:/.test(base) || !Number.isInteger(i) || i < 0) return new NextResponse("Bad request", { status: 400 });
  const data = await getProctorShot(base, i);
  const m = data && /^data:(image\/(?:jpeg|webp));base64,(.+)$/.exec(data);
  if (!m) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=300" },
  });
}
