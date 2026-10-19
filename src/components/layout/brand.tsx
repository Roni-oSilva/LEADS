import { Radar } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[#4f46e5] text-white shadow-lg shadow-primary/20">
        <Radar className="h-4.5 w-4.5" aria-hidden />
      </div>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight">
          LeadFinder <span className="text-primary">Pro</span>
        </span>
      )}
    </div>
  );
}
