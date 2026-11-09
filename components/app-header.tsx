import Link from "next/link";
import { Suspense } from "react";
import { GraduationCap } from "lucide-react";
import { getViewer } from "@/lib/session";
import { UserMenu } from "@/components/user-menu";
import { NavLinks } from "@/components/nav-links";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/assessments", label: "Assessments" },
  { href: "/admin/papers", label: "Papers" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/submissions", label: "Submissions" },
];
const STUDENT_NAV = [{ href: "/dashboard", label: "My tests" }];

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <GraduationCap className="size-4" />
          </span>
          <span className="hidden sm:inline">Mock Test Simulator</span>
        </Link>
        <Suspense fallback={<Skeleton className="ml-auto h-8 w-40" />}>
          <ViewerArea />
        </Suspense>
      </div>
    </header>
  );
}

async function ViewerArea() {
  const v = await getViewer();
  if (!v) {
    return (
      <Button asChild size="sm" className="ml-auto">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }
  return (
    <>
      <NavLinks items={v.role === "admin" ? ADMIN_NAV : STUDENT_NAV} />
      <UserMenu name={v.name} email={v.email} image={v.image} role={v.role} />
    </>
  );
}
