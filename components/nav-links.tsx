"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Item = { href: string; label: string };
const isActive = (path: string, href: string) => href === path || (href !== "/admin" && href !== "/dashboard" && path.startsWith(href));

/** Inline links from 768px up; a slide-out menu on phones. */
export function NavLinks({ items }: { items: Item[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = items.find((it) => isActive(path, it.href));
  return (
    <>
      <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
        {items.map((it) => (
          <Link key={it.href} href={it.href}
            className={cn("rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", isActive(path, it.href) && "bg-muted font-medium text-foreground")}>
            {it.label}
          </Link>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 items-center md:hidden">
        {items.length > 1 ? (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="-ml-1 gap-2"><Menu />{current?.label || "Menu"}</Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetHeader><SheetTitle>Mock Test Simulator</SheetTitle></SheetHeader>
              <nav className="grid gap-1 px-4">
                {items.map((it) => (
                  <Link key={it.href} href={it.href} onClick={() => setOpen(false)}
                    className={cn("rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", isActive(path, it.href) && "bg-muted font-medium text-foreground")}>
                    {it.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        ) : (
          items[0] && <Link href={items[0].href} className="rounded-md bg-muted px-2.5 py-1.5 text-sm font-medium">{items[0].label}</Link>
        )}
      </div>
    </>
  );
}
