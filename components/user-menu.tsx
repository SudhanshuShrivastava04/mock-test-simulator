import { LogOut, Monitor } from "lucide-react";
import { signOut } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export function UserMenu({ name, email, image, role }: { name: string; email: string; image?: string; role: string }) {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ml-auto flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Badge variant="secondary" className="hidden capitalize sm:inline-flex">{role}</Badge>
        <Avatar className="size-8">
          {image && <AvatarImage src={image} alt="" />}
          <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground"><Monitor className="size-4" />Theme</span>
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full"><LogOut />Sign out</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
