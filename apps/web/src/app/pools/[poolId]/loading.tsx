export default function Loading() {
  return <div className="h-[640px] animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-busy="true" aria-label="Loading pool" />;
}
