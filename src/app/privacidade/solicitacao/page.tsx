import { DsarForm } from "@/components/forms/dsar-form";
import { Brand } from "@/components/layout/brand";

export const metadata = { title: "Solicitação de titular de dados", robots: { index: false } };

export default async function DsarPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  const valid = !!org && /^[a-z0-9-]{3,60}$/.test(org);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Brand />
      <div className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Direitos do titular (LGPD)</h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">Peça acesso, correção, eliminação, portabilidade ou a interrupção de contatos comerciais.</p>
        {valid ? <DsarForm org={org!} /> : <p className="text-sm text-danger">Link incompleto. Use o endereço fornecido pela empresa que entrou em contato com você.</p>}
      </div>
    </main>
  );
}
