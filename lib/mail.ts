import "server-only";
import nodemailer from "nodemailer";
import type { Assessment, MailStatus } from "@/lib/types";
import { fmtWindow } from "@/lib/status";

// Invites go out over SMTP. With a Gmail account: SMTP_USER = the address, SMTP_PASS = a
// Google "app password" (Google Account → Security → 2-Step Verification → App passwords).
const configured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: nodemailer.Transporter | null = null;
function tx() {
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    // Google shows app passwords in groups of four; the spaces aren't part of it
    auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || "").replace(/\s+/g, "") },
  });
  return transport;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function sendInvite(opts: { to: string; assessment: Assessment; url: string; invitedBy: string }): Promise<MailStatus> {
  const { to, assessment: a, url } = opts;
  if (!configured()) {
    if (process.env.NODE_ENV !== "production") console.log(`[mail] (SMTP not set) invite for ${to}: ${url}`);
    return { status: "skipped", at: Date.now(), error: "Email isn't set up, so share the link yourself." };
  }
  const subject = `You're invited: ${a.title}`;
  const when = fmtWindow(a);
  const text = `You've been invited to take "${a.title}" (${a.durationMinutes} minutes).

When: ${when}
Start here: ${url}

Sign in with this Google account (${to}) to begin. After you submit, your results and the solution links appear on your dashboard.`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111">
  <p style="color:#666;margin:0 0 4px">Mock Test Simulator</p>
  <h1 style="font-size:22px;margin:0 0 16px">${esc(a.title)}</h1>
  <p>You've been invited to take this assessment.</p>
  <table style="border-collapse:collapse;margin:12px 0 20px;font-size:15px">
    <tr><td style="padding:4px 16px 4px 0;color:#666">Duration</td><td>${a.durationMinutes} minutes</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#666">When</td><td>${esc(when)}</td></tr>
  </table>
  <a href="${esc(url)}" style="display:inline-block;background:#2b50d6;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Open the assessment</a>
  <p style="color:#666;font-size:13px;margin-top:24px">Sign in with Google as ${esc(to)}. After you submit, your results and solution links show up on your dashboard.</p>
</div>`;
  try {
    await tx().sendMail({ from: process.env.MAIL_FROM || `Mock Test Simulator <${process.env.SMTP_USER}>`, to, subject, text, html });
    return { status: "sent", at: Date.now() };
  } catch (e) {
    return { status: "failed", at: Date.now(), error: (e as Error).message.slice(0, 300) };
  }
}
