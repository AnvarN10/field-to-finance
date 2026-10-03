"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Large-type tagline. Words move from muted to full ink one at a time, in reading order,
 * once the block enters the viewport. Without JS, or with reduced motion, it is plain text.
 */
export function Tagline({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [state, setState] = useState<"static" | "muted" | "lit">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.7) return;
    setState("muted");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState("lit");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -30% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const words = text.split(" ");
  return (
    <p ref={ref} data-tagline={state} className={className}>
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          className="transition-opacity duration-400 ease-(--ease-out) [[data-tagline=muted]_&]:opacity-30"
          style={{ transitionDelay: state === "lit" ? `${i * 45}ms` : "0ms" }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}
