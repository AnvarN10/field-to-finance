/**
 * Large-type tagline. Each word is its own span so LandingMotion can light the words one by one in
 * reading order as the block scrolls through the viewport. Without JS or with reduced motion it is plain text.
 */
export function Tagline({ text, className = "" }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <p data-tagline className={className}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} data-tagline-word>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
