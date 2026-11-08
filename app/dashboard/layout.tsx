import { AppHeader } from "@/components/app-header";

export default function StudentLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
