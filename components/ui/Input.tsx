import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string }>(
  function Input({ label, className = "", id, ...rest }, ref) {
    const input = (
      <input
        ref={ref}
        id={id}
        className={`h-12 w-full rounded-[var(--radius-btn)] border border-line bg-surface-2 px-4 text-text placeholder:text-muted/70 transition-colors focus:border-saffron focus:outline-none ${className}`}
        {...rest}
      />
    );
    if (!label) return input;
    return (
      <label className="flex flex-col gap-1.5 text-sm text-muted" htmlFor={id}>
        {label}
        {input}
      </label>
    );
  },
);
