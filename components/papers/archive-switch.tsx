"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { archivePaper } from "@/app/admin/papers/actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ArchiveSwitch({ paperId, archived }: { paperId: string; archived: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor="archive">Archive</Label>
        <p className="text-xs text-muted-foreground">Hides it from the paper picker for new assessments. Existing assessments keep working.</p>
      </div>
      <Switch id="archive" checked={archived} disabled={pending}
        onCheckedChange={(v) => start(async () => { try { await archivePaper(paperId, v); toast.success(v ? "Archived" : "Restored"); } catch (e) { toast.error((e as Error).message); } })} />
    </div>
  );
}
