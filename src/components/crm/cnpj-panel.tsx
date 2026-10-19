"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { enrichFromCnpjAction } from "@/lib/cnpj-actions";
import { formatCnpj } from "@/lib/cnpj";

export function CnpjPanel({ leadId, cnpj, disabled }: { leadId: string; cnpj: string | null; disabled?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(cnpj ? formatCnpj(cnpj) : "");
  const [pending, start] = useTransition();
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await enrichFromCnpjAction(leadId, v);
        if (!r.ok) return void toast.error(r.error);
        toast.success(r.data!.filled.length ? `Preenchido: ${r.data!.filled.join(", ")}.` : "CNPJ consultado; nenhum campo vazio para preencher.");
        router.refresh();
      });
    }}>
      <Input inputMode="numeric" placeholder="00.000.000/0000-00" value={v} onChange={(e) => setV(e.target.value)} maxLength={18} disabled={disabled} aria-label="CNPJ" />
      <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={disabled || v.replace(/\D/g, "").length < 14}><Landmark className="h-3.5 w-3.5" aria-hidden /> Completar dados pelo CNPJ</Button>
      <p className="text-[11px] text-muted-foreground">Consulta pública gratuita (BrasilAPI/Receita Federal). Só preenche campos vazios (telefone, e-mail, endereço) e não traz dados de sócios.</p>
    </form>
  );
}
