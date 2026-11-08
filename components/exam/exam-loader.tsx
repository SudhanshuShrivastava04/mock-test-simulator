"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// The exam keeps its state in localStorage and drives in-browser runtimes, so it renders on the
// client only. Loading it lazily also keeps CodeMirror out of every other page's bundle.
export const ExamLoader = dynamic(() => import("./exam-app").then((m) => m.ExamApp), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 flex-col">
      <div className="flex h-14 items-center gap-4 border-b px-4"><Skeleton className="h-6 w-48" /><Skeleton className="ml-auto h-8 w-64" /></div>
      <div className="grid flex-1 gap-6 p-6 md:grid-cols-[1fr_280px]"><Skeleton className="h-96" /><Skeleton className="h-72" /></div>
    </div>
  ),
});
