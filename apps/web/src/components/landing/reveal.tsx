"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Light scroll reveal (style-lock: landing reveals 400ms, ease-out; reduced motion keeps
 * the fade and drops the movement). Content renders visible on the server and without JS.
 */
export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen: no animation
    setState("hidden");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={state}
      className={`transition-[opacity,translate] duration-400 ease-(--ease-out) data-[reveal=hidden]:translate-y-4 data-[reveal=hidden]:opacity-0 motion-reduce:data-[reveal=hidden]:translate-y-0 ${className}`}
    >
      {children}
    </div>
  );
}
