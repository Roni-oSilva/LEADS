import { AppShell } from "@/components/layout/app-shell";
import { getContext } from "@/lib/auth";

// Dados dependem da sessão do usuário: nunca pré-renderizar estaticamente.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  return (
    <AppShell orgName={ctx.orgName} userName={ctx.fullName} email={ctx.email} role={ctx.role}>
      {children}
    </AppShell>
  );
}
