import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  // Шафран — только для одного главного действия на экране
  primary: "bg-saffron text-on-saffron hover:brightness-110 shadow-[0_0_24px_var(--glow)]",
  secondary: "bg-surface-2 text-text border border-line hover:bg-line/60",
  danger: "bg-pomegranate text-on-pomegranate hover:brightness-110",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-3 text-sm gap-1.5",
  md: "h-12 px-5 text-[15px] gap-2", // на кассе кнопки не ниже 48px
  lg: "h-14 px-6 text-base gap-2.5",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className = "", type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex select-none items-center justify-center rounded-[var(--radius-btn)] font-semibold transition-[transform,background-color,filter,color] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  );
});
