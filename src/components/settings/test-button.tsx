"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { testIntegrationAction } from "@/lib/integrations/actions";

export function TestConnectionButton({ providerKey, disabled }: { providerKey: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ status: string; message: string } | null>(null);
  return (
    <div className="space-y-2">
      <Button size="sm" variant="secondary" loading={pending} disabled={disabled} onClick={() => start(async () => { const r = await testIntegrationAction(providerKey); setRes(r.ok ? r.data! : { status: "error", message: r.error }); router.refresh(); })}><PlugZap className="h-3.5 w-3.5" aria-hidden /> Testar conexão</Button>
      {res && <Alert variant={res.status === "ok" ? "success" : res.status === "not_configured" ? "warning" : "danger"}>{res.message}</Alert>}
    </div>
  );
}
