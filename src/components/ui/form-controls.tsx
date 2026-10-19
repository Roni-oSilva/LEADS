import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-border bg-muted/60 px-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, "h-9", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(field, "min-h-20 py-2", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(field, "h-9 pr-8", className)} {...p}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-muted-foreground", className)} {...p} />;
}

const CONTROLS: unknown[] = [];

/** Rótulo + controle + dica/erro, com `htmlFor`/`id` e `aria-describedby` associados automaticamente. */
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  const id = React.useId();
  const isControl = React.isValidElement(children) && CONTROLS.includes(children.type);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = isControl
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: (children as React.ReactElement<{ id?: string }>).props.id ?? id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;
  const targetId = isControl ? ((children as React.ReactElement<{ id?: string }>).props.id ?? id) : undefined;
  return (
    <div className={className}>
      <Label htmlFor={targetId}>{label}</Label>
      {control}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
CONTROLS.push(Input, Textarea, Select);

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} type="checkbox" className={cn("h-4 w-4 cursor-pointer rounded border-border bg-muted accent-[#7c6cf6]", className)} {...p} />
));
Checkbox.displayName = "Checkbox";
