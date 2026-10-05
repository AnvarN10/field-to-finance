import type { ComponentProps } from "react";
import { Input } from "../ui/input";

/** Labelled input with its error and hint wired to aria-describedby. */
export function TextField({ label, name, error, hint, className, ...props }: { label: string; name: string; error?: string; hint?: string } & ComponentProps<"input">) {
  const errId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-medium ${className ?? ""}`}>
      {label}
      <Input
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
        className="h-10"
        {...props}
      />
      {error ? (
        <span id={errId} className="text-xs font-normal text-destructive">
          {error}
        </span>
      ) : null}
      {hint ? (
        <span id={hintId} className="text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
