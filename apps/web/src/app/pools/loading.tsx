export default function Loading() {
  return (
    <div className="grid gap-4 md:grid-cols-2" role="status" aria-busy="true" aria-label="Loading pools">
      {[0, 1].map((i) => (
        <div key={i} className="h-44 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      ))}
    </div>
  );
}
