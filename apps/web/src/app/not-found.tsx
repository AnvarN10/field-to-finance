import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-muted-foreground">This pool, field or page does not exist on devnet.</p>
      <Link href="/pools" className="text-gold-text underline underline-offset-4">
        Back to pools
      </Link>
    </div>
  );
}
