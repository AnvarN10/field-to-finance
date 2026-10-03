export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 border-l border-border pl-4">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="tabular text-2xl font-semibold">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
