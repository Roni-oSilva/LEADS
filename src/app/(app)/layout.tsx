import { AppShell } from "@/components/layout/app-shell";
import { getContext } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  return (
    <AppShell orgName={ctx.orgName} userName={ctx.fullName} email={ctx.email} role={ctx.role}>
      {children}
    </AppShell>
  );
}
