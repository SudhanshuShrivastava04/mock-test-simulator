import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { signIn } from "@/lib/auth";
import { DEV_LOGIN, GOOGLE_CONFIGURED } from "@/lib/env";
import { getViewer, homeFor } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, { title: string; text: string }> = {
  NotInvited: { title: "This account isn't on the list", text: "Ask your teacher to add this Google account, or sign in with the email address the invite was sent to." },
  Unverified: { title: "Email not verified", text: "Google hasn't verified this account's email address." },
  AccessDenied: { title: "Access denied", text: "This account can't sign in here." },
  Configuration: { title: "Sign-in isn't set up", text: "The server is missing its Google sign-in settings." },
};

// only same-site paths, never an absolute URL from the query string
const safePath = (p: unknown) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : null);

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <>
      <AppHeader />
      <main className="grid flex-1 place-items-center px-4 py-16">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Use the Google account your invite was sent to.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-9 w-full" />}>
              <LoginForms searchParams={props.searchParams} />
            </Suspense>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

async function LoginForms({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const v = await getViewer();
  const next = safePath(sp.callbackUrl);
  if (v) redirect(next || homeFor(v));
  const err = typeof sp.error === "string" ? ERRORS[sp.error] || ERRORS.AccessDenied : null;

  async function google() {
    "use server";
    await signIn("google", { redirectTo: next || "/dashboard" });
  }
  async function dev(fd: FormData) {
    "use server";
    await signIn("dev", { email: String(fd.get("email") || ""), redirectTo: next || "/dashboard" });
  }

  return (
    <div className="grid gap-4">
      {err && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{err.title}</AlertTitle>
          <AlertDescription>{err.text}</AlertDescription>
        </Alert>
      )}
      {GOOGLE_CONFIGURED ? (
        <form action={google}>
          <Button type="submit" size="lg" className="w-full">
            <GoogleIcon /> Continue with Google
          </Button>
        </form>
      ) : (
        <Alert>
          <AlertCircle />
          <AlertTitle>Google sign-in isn&apos;t configured</AlertTitle>
          <AlertDescription>Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (see the README).</AlertDescription>
        </Alert>
      )}
      {DEV_LOGIN && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><Separator className="flex-1" />local dev only<Separator className="flex-1" /></div>
          <form action={dev} className="grid gap-2">
            <Label htmlFor="dev-email">Sign in as</Label>
            <Input id="dev-email" name="email" type="email" required placeholder="someone@example.com" />
            <Button type="submit" variant="outline">Dev sign-in</Button>
          </form>
        </>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#fff" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.48C16.68 3.68 14.55 2.7 12 2.7 6.86 2.7 2.7 6.86 2.7 12s4.16 9.3 9.3 9.3c5.37 0 8.93-3.77 8.93-9.09 0-.61-.07-1.08-.16-1.55z" />
    </svg>
  );
}
