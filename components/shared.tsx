import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { STATE_LABEL, type AttemptState } from "@/lib/status";

export function PageHeader({ title, description, children }: { title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function AppMain({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <main className={cn("mx-auto w-full flex-1 px-4 py-8", wide ? "max-w-7xl" : "max-w-6xl")}>{children}</main>;
}

const STATE_STYLE: Record<AttemptState, string> = {
  invited: "bg-primary/10 text-primary",
  in_progress: "bg-warning-soft text-warning",
  submitted: "bg-success-soft text-success",
  missed: "bg-muted text-muted-foreground",
};

export function StateBadge({ state }: { state: AttemptState }) {
  return <Badge className={cn("border-0", STATE_STYLE[state])}>{STATE_LABEL[state]}</Badge>;
}

export function Empty({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96 max-w-full" /></div>
      <div className="grid gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <ListSkeleton />
    </div>
  );
}

export function fmtDate(t: number | null | undefined, withTime = true) {
  if (!t) return "—";
  return new Date(t).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata",
  });
}
