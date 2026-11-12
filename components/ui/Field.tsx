import { forwardRef, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

const base =
  "w-full rounded-[var(--radius-btn)] border border-line bg-surface-2 px-4 text-text placeholder:text-muted/70 transition-colors focus:border-saffron focus:outline-none";

export function FieldLabel({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-muted">
      {label}
      {children}
      {hint && <span className="text-xs text-muted/80">{hint}</span>}
    </label>
  );
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = "", children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={`${base} h-12 appearance-none pr-10 ${className}`} {...rest}>
        {children}
      </select>
      <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className = "", ...rest },
  ref,
) {
  return <textarea ref={ref} className={`${base} min-h-20 py-3 ${className}`} {...rest} />;
});
