/**
 * Minimal Shadcn-shaped primitives inlined here so we don't need the CLI
 * to bootstrap the slice. When the design system solidifies, swap these
 * for `shadcn@latest add button` etc.
 */

import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Button ────────────────────────────────────────────────────────────────

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    primary: "bg-[var(--color-primary)] text-white hover:opacity-90 focus-visible:ring-[var(--color-primary)]",
    secondary: "bg-black/5 text-[var(--color-fg)] hover:bg-black/10",
    ghost: "hover:bg-black/5 text-[var(--color-fg)]",
  };
  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────────

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "block w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm shadow-sm transition",
        "placeholder:text-black/40 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30",
        className,
      )}
      {...props}
    />
  );
}

// ─── Label ─────────────────────────────────────────────────────────────────

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-sm font-medium text-[var(--color-fg)]", className)}>
      {children}
    </label>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-black/5 bg-white p-6 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-lg font-semibold">{children}</h2>;
}

export function CardDescription({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-sm text-[var(--color-muted)]">{children}</p>;
}

// ─── FieldError ───────────────────────────────────────────────────────────

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-red-600">{children}</p>;
}

// ─── Alert ────────────────────────────────────────────────────────────────

export function Alert({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  const tones = {
    info: "bg-blue-50 text-blue-900 border-blue-200",
    error: "bg-red-50 text-red-900 border-red-200",
    success: "bg-green-50 text-green-900 border-green-200",
  };
  return (
    <div className={cn("rounded-md border px-4 py-3 text-sm", tones[tone])}>{children}</div>
  );
}
