"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { MOBILE_PRIMARY, NAV_ITEMS } from "./nav";
import { logoutAction } from "@/lib/auth-actions";

interface Props {
  orgName: string;
  userName: string;
  email: string;
  role: string;
  children: React.ReactNode;
}

const ROLE_LABEL: Record<string, string> = { owner: "Proprietário", admin: "Administrador", member: "Membro", viewer: "Leitura" };

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-primary-soft text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserBox({ orgName, userName, email, role }: Omit<Props, "children">) {
  return (
    <div className="rounded-lg border border-border bg-card-2/60 p-3">
      <p className="truncate text-xs font-medium">{orgName}</p>
      <p className="truncate text-xs text-muted-foreground">{userName || email}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{ROLE_LABEL[role] ?? role}</span>
        <form action={logoutAction}>
          <button type="submit" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Sair
          </button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({ children, ...user }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const primary = NAV_ITEMS.filter((i) => MOBILE_PRIMARY.includes(i.href));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-card/60 p-4 lg:flex">
        <Brand />
        <div className="-mx-1 flex-1 overflow-y-auto px-1"><NavList pathname={pathname} /></div>
        <UserBox {...user} />
      </aside>

      {/* Topo mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button aria-label="Abrir menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Drawer mobile com todos os itens */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button aria-label="Fechar menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-72 max-w-[85%] animate-fade-in flex-col gap-4 border-l border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <Brand />
              <button aria-label="Fechar" onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto"><NavList pathname={pathname} onNavigate={() => setOpen(false)} /></div>
            <UserBox {...user} />
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">
        <div className="mx-auto max-w-[1400px] animate-fade-in">{children}</div>
      </main>

      {/* Barra inferior mobile */}
      <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px]", active ? "text-primary" : "text-muted-foreground")}>
              <Icon className="h-5 w-5" aria-hidden />
              <span className="max-w-full truncate px-1">{label.replace("Encontrar ", "").replace("Funil de Vendas", "Funil").replace("Meu ", "")}</span>
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground">
          <MoreHorizontal className="h-5 w-5" aria-hidden />
          Mais
        </button>
      </nav>
    </div>
  );
}
