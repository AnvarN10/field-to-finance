import { ExternalLink } from "lucide-react";
import { explorerAddress, explorerTx, shortKey } from "../lib/format";

export function ExplorerLink({
  kind,
  value,
  cluster = "devnet",
  label,
}: {
  kind: "tx" | "address";
  value: string;
  cluster?: string;
  label?: string;
}) {
  const href = kind === "tx" ? explorerTx(value, cluster) : explorerAddress(value, cluster);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={value}
      className="inline-flex items-center gap-1 rounded-sm font-mono text-[13px] text-foreground underline decoration-muted-foreground underline-offset-4 hover:decoration-foreground"
    >
      {label ?? shortKey(value)}
      <ExternalLink aria-hidden strokeWidth={1.5} className="size-3.5 text-muted-foreground" />
      <span className="sr-only">(opens Solana Explorer)</span>
    </a>
  );
}
