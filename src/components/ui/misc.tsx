import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function EmptyState({ icon: Icon = Inbox, title, description, children }: { icon?: React.ElementType; title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-md text-xs text-muted-foreground">{description}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

export function Alert({ variant = "info", title, children, className }: { variant?: "info" | "warning" | "danger" | "success"; title?: string; children?: React.ReactNode; className?: string }) {
  const map = {
    info: { Icon: Info, cls: "border-info/30 bg-info/10 text-info" },
    warning: { Icon: AlertTriangle, cls: "border-warning/30 bg-warning/10 text-warning" },
    danger: { Icon: AlertTriangle, cls: "border-danger/30 bg-danger/10 text-danger" },
    success: { Icon: CheckCircle2, cls: "border-success/30 bg-success/10 text-success" },
  }[variant];
  return (
    <div role={variant === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-3 text-sm", map.cls, className)}>
      <map.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 text-foreground/90">
        {title && <p className="font-medium text-current">{title}</p>}
        {children && <div className="text-xs leading-relaxed text-foreground/80">{children}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ScoreBadge({ score, priority }: { score: number; priority: string }) {
  const cls = priority === "high" ? "text-success bg-success/10 border-success/30" : priority === "medium" ? "text-warning bg-warning/10 border-warning/30" : "text-muted-foreground bg-muted border-border";
  return <span className={cn("inline-flex min-w-9 justify-center rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums", cls)}>{score}</span>;
}
