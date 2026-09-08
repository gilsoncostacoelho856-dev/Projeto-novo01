"use client";

import { forwardRef, type ReactNode } from "react";
import { IconAlert, IconCheck } from "@/components/icons";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ superficie */

export function Card({
  children,
  className,
  style,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  /** Escape hatch para cores vindas de token (ex.: destacar um card crítico). */
  style?: React.CSSProperties;
  as?: "section" | "div" | "form" | "li";
}) {
  return (
    <Tag
      style={style}
      className={cx(
        "rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-ink-2">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------------- botoes */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  block?: boolean;
};

const BUTTON_VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-accent text-white hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-line bg-surface text-ink hover:bg-surface-2 disabled:opacity-50",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50",
  danger: "border border-line text-[var(--critical)] hover:bg-surface-2 disabled:opacity-50",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors",
        // 44px de altura minima: alvo de toque confortavel no celular
        size === "md" ? "min-h-11 px-4 text-sm" : "min-h-9 px-3 text-sm",
        block && "w-full",
        BUTTON_VARIANTS[variant],
        "disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
});

export function IconButton({
  label,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        "inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------------- campos */

const FIELD_CLASS =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted " +
  // 16px evita o zoom automatico do Safari no iPhone ao focar o campo
  "min-h-11 outline-none transition-colors focus:border-accent";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-[var(--critical)]">
          <IconAlert className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-ink-2">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cx(FIELD_CLASS, className)} {...props} />;
  },
);

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select ref={ref} className={cx(FIELD_CLASS, "appearance-none pr-9", className)} {...props}>
      {props.children}
    </select>
  );
});

/* --------------------------------------------------------------------- avisos */

export function Alert({
  tone = "critical",
  title,
  children,
}: {
  tone?: "critical" | "warning" | "good" | "info";
  title?: string;
  children: ReactNode;
}) {
  const color = {
    critical: "var(--critical)",
    warning: "var(--warning)",
    good: "var(--good)",
    info: "var(--accent)",
  }[tone];

  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <span style={{ color }} className="mt-0.5 shrink-0">
        {tone === "good" ? <IconCheck className="h-5 w-5" /> : <IconAlert className="h-5 w-5" />}
      </span>
      <div className="text-sm text-ink-2">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx("animate-pulse rounded-xl bg-surface-2", className)}
      aria-hidden="true"
    />
  );
}

/** Ponto colorido que carrega a identidade da categoria ao lado do texto. */
export function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)}
      style={{ background: color }}
    />
  );
}
