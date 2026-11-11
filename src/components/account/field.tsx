import type { InputHTMLAttributes } from "react";

/** Labelled text field with an optional hint and error, tap target of 48 px. */
export function Field({
  id,
  label,
  hint,
  error,
  className = "",
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`min-h-12 rounded-2xl border-2 bg-card px-3.5 text-base text-card-foreground focus-visible:outline-none focus-visible:border-primary ${
          error ? "border-accent-text" : "border-border"
        } ${className}`}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-accent-text">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
