import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const cls = "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
      <span>{from}–{to} de {total}</span>
      <div className="flex items-center gap-2">
        <span>Página {page} de {pages}</span>
        {page > 1 ? <Link href={href(page - 1)} aria-label="Página anterior" className={cls}><ChevronLeft className="h-4 w-4" /></Link> : <span aria-hidden className={cn(cls, "opacity-30")}><ChevronLeft className="h-4 w-4" /></span>}
        {page < pages ? <Link href={href(page + 1)} aria-label="Próxima página" className={cls}><ChevronRight className="h-4 w-4" /></Link> : <span aria-hidden className={cn(cls, "opacity-30")}><ChevronRight className="h-4 w-4" /></span>}
      </div>
    </div>
  );
}
