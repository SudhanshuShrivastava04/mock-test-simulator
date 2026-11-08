import Link from "next/link";
import { Suspense } from "react";
import { BarChart3, Code2, MailPlus, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { HowItWorks } from "@/components/how-it-works";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getViewer, homeFor } from "@/lib/session";

const FEATURES = [
  { icon: MailPlus, title: "Invite by email", text: "Add a student's Gmail address and they get an invite link. They sign in with Google, nothing else to set up." },
  { icon: Code2, title: "Real coding environment", text: "Python, Java, C++ and SQL run right in the browser against sample and hidden tests, with time limits." },
  { icon: BarChart3, title: "Every attempt on record", text: "Scores, topic breakdowns, submitted code and solution links stay on the dashboard for both of you." },
  { icon: ShieldCheck, title: "Role-based access", text: "The admin creates tests, invites and grades. Students only see their own tests and results." },
];

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-14 sm:py-20">
        <section className="max-w-3xl">
          <p className="mb-3 text-sm font-medium text-primary">CS fundamentals · DSA · SQL</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Timed mock tests with a built-in code runner</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Run assessments for your students end to end: invite them by email, let them code against hidden tests, then review and grade every attempt in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Suspense fallback={<Button size="lg" disabled>Sign in with Google</Button>}>
              <Cta />
            </Suspense>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <f.icon className="mb-2 size-5 text-primary" />
                <CardTitle>{f.title}</CardTitle>
                <CardDescription>{f.text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="mb-4 text-xl font-semibold">How the coding questions work</h2>
          <Card>
            <CardContent>
              <HowItWorks />
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}

async function Cta() {
  const v = await getViewer();
  return (
    <Button size="lg" asChild>
      <Link href={homeFor(v)}>{v ? "Go to your dashboard" : "Sign in with Google"}</Link>
    </Button>
  );
}
