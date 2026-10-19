"use client";

import { SegmentOptions } from "@/components/ui/segment-options";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { UF_LIST } from "@/lib/constants";
import { leadInputSchema, type LeadInput } from "@/lib/leads/schema";
import { createLeadAction, updateLeadAction } from "@/lib/leads/actions";

type Initial = Partial<Record<keyof LeadInput, string | number | null>>;

export function LeadForm({ leadId, initial, members, onDone }: { leadId?: string; initial?: Initial; members: { id: string; name: string }[]; onDone: (id?: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<LeadInput>({
    resolver: zodResolver(leadInputSchema) as never,
    defaultValues: Object.fromEntries(Object.entries(initial ?? {}).map(([k, v]) => [k, v ?? ""])) as LeadInput,
  });

  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={handleSubmit((values) =>
        start(async () => {
          setError(null);
          const r = leadId ? await updateLeadAction(leadId, values) : await createLeadAction(values);
          if (!r.ok) return setError(r.error);
          if (!leadId && r.data && "duplicate" in r.data && r.data.duplicate) toast.warning("Já existe um lead com estes dados — nenhum registro novo foi criado.");
          else toast.success(leadId ? "Lead atualizado." : "Lead cadastrado.");
          onDone(r.data && "id" in r.data ? r.data.id : undefined);
        }),
      )}
    >
      {error && <div className="sm:col-span-2"><Alert variant="danger">{error}</Alert></div>}
      <Field label="Empresa *" error={errors.company_name?.message} className="sm:col-span-2"><Input {...register("company_name")} /></Field>
      <Field label="Contato comercial" error={errors.contact_name?.message}><Input {...register("contact_name")} /></Field>
      <Field label="E-mail profissional" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
      <Field label="Telefone comercial" error={errors.phone?.message}><Input inputMode="tel" {...register("phone")} /></Field>
      <Field label="WhatsApp comercial" error={errors.whatsapp?.message} hint="Somente números comerciais públicos."><Input inputMode="tel" {...register("whatsapp")} /></Field>
      <Field label="Site" error={errors.website?.message}><Input placeholder="https://" {...register("website")} /></Field>
      <Field label="Instagram" error={errors.instagram?.message}><Input placeholder="https://instagram.com/..." {...register("instagram")} /></Field>
      <Field label="Segmento" error={errors.segment?.message}>
        <Select {...register("segment")}><option value="">—</option><SegmentOptions /></Select>
      </Field>
      <Field label="Categoria" error={errors.category?.message}><Input {...register("category")} /></Field>
      <Field label="Estado" error={errors.state?.message}>
        <Select {...register("state")}><option value="">—</option>{UF_LIST.map((u) => <option key={u}>{u}</option>)}</Select>
      </Field>
      <Field label="Cidade" error={errors.city?.message}><Input {...register("city")} /></Field>
      <Field label="Bairro" error={errors.neighborhood?.message}><Input {...register("neighborhood")} /></Field>
      <Field label="Endereço" error={errors.address?.message}><Input {...register("address")} /></Field>
      {leadId && (
        <>
          <Field label="Responsável">
            <Select {...register("owner_id")}><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
          </Field>
          <Field label="Valor estimado (R$)" error={errors.estimated_value?.message as string | undefined}><Input type="number" step="0.01" min="0" {...register("estimated_value")} /></Field>
        </>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={() => onDone()}>Cancelar</Button>
        <Button type="submit" loading={pending}>{leadId ? "Salvar alterações" : "Cadastrar lead"}</Button>
      </div>
    </form>
  );
}
export { UF_LIST };
