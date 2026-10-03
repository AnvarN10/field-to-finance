export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect width="24" height="24" rx="6" fill="var(--primary)" />
      <path d="M5 16h14M5 12h14M5 8h9" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
