"use client";

import { useMemo, useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { SERVICES } from "@/lib/constants";
import { buildWhatsAppLink, looksLikeMobile, renderTemplate } from "@/lib/whatsapp/link";
import { registerWhatsAppStartedAction } from "@/lib/whatsapp/actions";

interface Props {
  leadId?: string;
  company: string;
  contact?: string | null;
  phone: string | null;
  template: string;
  suggestedService?: string | null;
  blockedReason?: string | null;
  variant?: "icon" | "button";
}

export function WhatsAppButton({ leadId, company, contact, phone, template, suggestedService, blockedReason, variant = "icon" }: Props) {
  const [open, setOpen] = useState(false);
  const [service, setService] = useState(suggestedService ?? "");
  const [pending, start] = useTransition();
  const initial = useMemo(() => renderTemplate(template, { empresa: company, servico: service || null, contato: contact }), [template, company, service, contact]);
  const [message, setMessage] = useState<string | null>(null);
  const text = message ?? initial;
  const link = buildWhatsAppLink(phone, text);
  const valid = !!link && !blockedReason;

  const trigger =
    variant === "icon" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!valid}
        title={blockedReason ?? (link ? "Iniciar conversa no WhatsApp" : "Sem número válido para WhatsApp")}
        aria-label="Iniciar conversa no WhatsApp"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-success/10 hover:text-success disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <MessageCircle className="h-4 w-4" />
      </button>
    ) : (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} disabled={!valid} title={blockedReason ?? undefined}>
        <MessageCircle className="h-4 w-4 text-success" aria-hidden /> WhatsApp
      </Button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onClose={() => setOpen(false)} title={`WhatsApp · ${company}`} description="Revise a mensagem antes de abrir a conversa.">
        <div className="space-y-4">
          {!looksLikeMobile(phone) && <Alert variant="warning">Este número parece ser fixo; ele pode não ter WhatsApp. Confirme antes de enviar.</Alert>}
          <Field label="Serviço a oferecer">
            <Select value={service} onChange={(e) => { setService(e.target.value); setMessage(null); }}>
              <option value="">Genérico (sem serviço específico)</option>
              {SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Mensagem" hint="Edite livremente. Evite enviar a mesma mensagem em massa.">
            <Textarea rows={8} value={text} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <p className="text-xs text-muted-foreground">
            O botão abre o WhatsApp com a mensagem preenchida (link oficial <code>wa.me</code>); você envia manualmente. O sistema não confirma envio nem entrega — apenas registra que a conversa foi iniciada por você.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              loading={pending}
              disabled={!link}
              onClick={() =>
                start(async () => {
                  if (leadId) {
                    const r = await registerWhatsAppStartedAction(leadId, text);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Conversa iniciada e registrada no histórico.");
                  }
                  window.open(link!, "_blank", "noopener,noreferrer");
                  setOpen(false);
                })
              }
            >
              <MessageCircle className="h-4 w-4" aria-hidden /> Abrir WhatsApp
            </Button>
          </div>
          {!leadId && <p className="text-[11px] text-muted-foreground">Este resultado ainda não foi salvo; salve-o para registrar o histórico de contato.</p>}
        </div>
      </Dialog>
    </>
  );
}
