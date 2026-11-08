"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const NEXT = { system: "light", light: "dark", dark: "system" } as const;

export function ThemeToggle() {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const { theme: t = "system", setTheme } = useTheme();
  const theme = mounted ? t : "system";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : SunMoon;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => { e.preventDefault(); setTheme(NEXT[theme as keyof typeof NEXT] || "system"); }}
      aria-label={`Theme: ${theme}`}
    >
      <Icon /> <span className="capitalize" >{theme}</span>
    </Button>
  );
}
