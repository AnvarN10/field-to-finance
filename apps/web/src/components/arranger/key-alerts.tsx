export function KeyAlerts({ keyProblems, mismatches }: { keyProblems: string[]; mismatches: string[] }) {
  if (!keyProblems.length && !mismatches.length) return null;
  return (
    <div role="alert" className="rounded-lg border border-destructive bg-card p-4 text-sm">
      {keyProblems.length ? <p>{`Server keys need attention: ${keyProblems.join("; ")}. Fix them in Infisical (field-to-finance, dev) and on Railway, then restart.`}</p> : null}
      {mismatches.map((m) => (
        <p key={m}>{m}</p>
      ))}
    </div>
  );
}
