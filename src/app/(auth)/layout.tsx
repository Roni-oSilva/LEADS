import { Brand } from "@/components/layout/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <div className="rounded-2xl border border-border bg-card/90 p-6 shadow-2xl backdrop-blur">{children}</div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prospecção responsável · <a className="underline hover:text-foreground" href="/privacidade">Política de privacidade</a>
        </p>
      </div>
    </main>
  );
}
