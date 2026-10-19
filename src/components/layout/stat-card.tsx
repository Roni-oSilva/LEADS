import { cn } from "@/lib/utils";

export function StatCard({ label, value, icon: Icon, hint, accent }: { label: string; value: string; icon: React.ElementType; hint?: string; accent?: "primary" | "success" | "warning" | "info" }) {
  const color = { primary: "text-primary bg-primary-soft", success: "text-success bg-success/10", warning: "text-warning bg-warning/10", info: "text-info bg-info/10" }[accent ?? "primary"];
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", color)}><Icon className="h-4 w-4" aria-hidden /></span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
