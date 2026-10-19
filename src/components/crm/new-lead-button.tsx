"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LeadForm } from "./lead-form";

export function NewLeadButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Novo lead</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Novo lead" description="Cadastre apenas dados comerciais públicos ou fornecidos pelo próprio contato." className="max-w-2xl">
        <LeadForm members={[]} onDone={(id) => { setOpen(false); if (id) router.push(`/crm/${id}`); else router.refresh(); }} />
      </Dialog>
    </>
  );
}
