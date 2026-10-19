import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Alert } from "@/components/ui/misc";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Configuração necessária" };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const sp = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-10">
      <Brand />
      {sp.reason === "no-organization" ? (
        <Alert variant="danger" title="Sua conta não está vinculada a nenhuma organização">
          Verifique se as migrações SQL (especialmente <code>0002_functions.sql</code>, que cria o trigger de novos usuários) foram aplicadas no Supabase. Depois, crie uma nova conta ou peça a um administrador para convidar seu e-mail.
        </Alert>
      ) : configured ? (
        <Alert variant="success" title="Supabase configurado">As variáveis de ambiente foram detectadas. <Link className="underline" href="/login">Ir para o login</Link>.</Alert>
      ) : (
        <Alert variant="warning" title="Supabase ainda não está conectado">
          O sistema precisa de um projeto Supabase para autenticação e banco de dados. Nenhum dado de demonstração é exibido.
        </Alert>
      )}
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Crie um projeto em <span className="text-foreground">supabase.com</span>.</li>
        <li>Rode as migrações de <code>supabase/migrations</code> (SQL Editor ou <code>supabase db push</code>).</li>
        <li>Copie <code>.env.example</code> para <code>.env.local</code> e preencha <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> e <code>SUPABASE_SERVICE_ROLE_KEY</code>.</li>
        <li>Reinicie o servidor (<code>npm run dev</code>) ou faça o redeploy na Vercel.</li>
      </ol>
      <p className="text-xs text-muted-foreground">Guia completo no <code>README.md</code>.</p>
    </main>
  );
}
