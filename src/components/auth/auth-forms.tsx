"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { forgotPasswordAction, loginAction, resetPasswordAction, signupAction } from "@/lib/auth-actions";
import { forgotSchema, loginSchema, resetSchema, signupSchema } from "@/lib/auth-schemas";

type Login = z.infer<typeof loginSchema>;
type Signup = z.input<typeof signupSchema>;

function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<Login>({ resolver: zodResolver(loginSchema) });
  return (
    <>
      <Title title="Entrar" subtitle="Acesse sua conta para continuar prospectando." />
      <form
        className="space-y-4"
        onSubmit={handleSubmit((v) =>
          start(async () => {
            setError(null);
            const r = await loginAction(v, next);
            if (r && !r.ok) setError(r.error);
          }),
        )}
        noValidate
      >
        {error && <Alert variant="danger">{error}</Alert>}
        <Field label="E-mail" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="voce@empresa.com" {...register("email")} />
        </Field>
        <Field label="Senha" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register("password")} />
        </Field>
        <Button type="submit" className="w-full" loading={pending}>Entrar</Button>
        <div className="flex justify-between text-xs text-muted-foreground">
          <Link href="/forgot-password" className="hover:text-foreground">Esqueci minha senha</Link>
          <Link href="/signup" className="text-primary hover:text-primary-hover">Criar conta</Link>
        </div>
      </form>
    </>
  );
}

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<Signup>({ resolver: zodResolver(signupSchema) });
  if (done)
    return (
      <div className="py-4 text-center">
        <MailCheck className="mx-auto mb-3 h-9 w-9 text-primary" aria-hidden />
        <h1 className="text-lg font-semibold">Verifique seu e-mail</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enviamos um link de confirmação. Depois de confirmar, você já pode entrar.</p>
        <Link href="/login" className="mt-4 inline-block text-sm text-primary hover:text-primary-hover">Ir para o login</Link>
      </div>
    );
  return (
    <>
      <Title title="Criar conta" subtitle="Crie sua organização e comece a organizar seus leads." />
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((v) =>
          start(async () => {
            setError(null);
            const r = await signupAction(v);
            if (r && !r.ok) setError(r.error);
            else if (r?.ok) setDone(true);
          }),
        )}
      >
        {error && <Alert variant="danger">{error}</Alert>}
        <Field label="Seu nome" error={errors.fullName?.message}><Input autoComplete="name" {...register("fullName")} /></Field>
        <Field label="Empresa / organização" error={errors.organizationName?.message}><Input autoComplete="organization" {...register("organizationName")} /></Field>
        <Field label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Senha" error={errors.password?.message} hint="Mínimo de 8 caracteres.">
          <Input type="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <Checkbox className="mt-0.5" {...register("accept")} />
            <span>Li e aceito a <a href="/privacidade" target="_blank" className="text-primary underline">política de privacidade</a>.</span>
          </label>
          {errors.accept && <p role="alert" className="mt-1 text-xs text-danger">{errors.accept.message}</p>}
        </div>
        <Button type="submit" className="w-full" loading={pending}>Criar conta</Button>
        <p className="text-center text-xs text-muted-foreground">Já tem conta? <Link href="/login" className="text-primary hover:text-primary-hover">Entrar</Link></p>
      </form>
    </>
  );
}

export function ForgotForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });
  return (
    <>
      <Title title="Recuperar senha" subtitle="Informe seu e-mail para receber o link de redefinição." />
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((v) =>
          start(async () => {
            const r = await forgotPasswordAction(v);
            setMsg(r.ok ? { ok: true, text: r.message ?? "Enviado." } : { ok: false, text: r.error });
          }),
        )}
      >
        {msg && <Alert variant={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
        <Field label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Button type="submit" className="w-full" loading={pending}>Enviar link</Button>
        <p className="text-center text-xs"><Link href="/login" className="text-muted-foreground hover:text-foreground">Voltar ao login</Link></p>
      </form>
    </>
  );
}

export function ResetForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  return (
    <>
      <Title title="Nova senha" subtitle="Defina uma nova senha para sua conta." />
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((v) =>
          start(async () => {
            const r = await resetPasswordAction(v);
            if (r && !r.ok) setError(r.error);
          }),
        )}
      >
        {error && <Alert variant="danger">{error}</Alert>}
        <Field label="Nova senha" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register("password")} /></Field>
        <Button type="submit" className="w-full" loading={pending}>Salvar nova senha</Button>
      </form>
    </>
  );
}
