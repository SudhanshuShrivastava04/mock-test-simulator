import { AppHeader } from "@/components/app-header";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
