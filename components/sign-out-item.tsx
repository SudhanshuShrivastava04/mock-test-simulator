"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { logout } from "@/app/auth/actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

// Calls the action directly: a <form> inside the menu would be unmounted (menu closing)
// before the browser got to submit it.
export function SignOutItem() {
  const [pending, start] = useTransition();
  return (
    <DropdownMenuItem disabled={pending} onSelect={(e) => { e.preventDefault(); start(() => logout()); }}>
      <LogOut />{pending ? "Signing out…" : "Sign out"}
    </DropdownMenuItem>
  );
}
