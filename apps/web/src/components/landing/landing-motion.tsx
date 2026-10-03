"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Style-lock Motion, landing values. Seconds, as GSAP takes them. */
export const LANDING_MOTION = {
  reveal: { duration: 0.6, distance: 16, ease: "power3.out", stagger: 0.06 },
  scrub: 0.5,
  /** GSAP power2 is cubic: power2.inOut equals the style-lock scrubbed-scroll curve cubic-bezier(0.65, 0, 0.35, 1). */
  stepEase: "power2.inOut",
  restingStepOpacity: 0.4,
  restingWordOpacity: 0.22,
  /** The rail runs horizontally from 1280px (matches the xl: classes in DealPath). */
  wideQuery: "(min-width: 1280px)",
  /** The deal path pins only where the whole section fits under the 56px header. */
  pinQuery: "(min-width: 1280px) and (min-height: 760px)",
} as const;

export const MOTION_OK_QUERY = "(prefers-reduced-motion: no-preference)";

/**
 * Scroll choreography for the landing page (GSAP + ScrollTrigger, tastemaker gsap-starter pattern).
 * Markup renders in its end state; this only adds motion, and gsap.matchMedia() reverts every tween and
 * pin when the viewer prefers reduced motion, so they see the static page.
 *
 * - [data-reveal] / [data-reveal-group]: fade and rise once on scroll into view.
 * - [data-tagline-word]: the problem tagline lights word by word, scrubbed by scroll.
 * - [data-rail]: the deal path fill and steps advance with scroll; the one pinned section, wide screens only.
 */
export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ motionOK: MOTION_OK_QUERY, wide: LANDING_MOTION.wideQuery, pin: LANDING_MOTION.pinQuery }, (ctx) => {
        const { motionOK, wide, pin } = ctx.conditions as { motionOK: boolean; wide: boolean; pin: boolean };
        if (!motionOK) return;
        const { reveal } = LANDING_MOTION;

        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          const targets = el.hasAttribute("data-reveal-group") ? Array.from(el.children) : el;
          gsap.from(targets, {
            opacity: 0,
            y: reveal.distance,
            duration: reveal.duration,
            ease: reveal.ease,
            stagger: reveal.stagger,
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          });
        });

        const tagline = root.current?.querySelector("[data-tagline]");
        if (tagline) {
          gsap.fromTo(
            tagline.querySelectorAll("[data-tagline-word]"),
            { opacity: LANDING_MOTION.restingWordOpacity },
            { opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: tagline, start: "top 80%", end: "bottom 45%", scrub: LANDING_MOTION.scrub } },
          );
        }

        const rail = root.current?.querySelector<HTMLElement>("[data-rail]");
        if (rail) {
          const steps = gsap.utils.toArray<HTMLElement>(rail.querySelectorAll("[data-rail-step]"));
          const section = rail.closest<HTMLElement>("[data-rail-section]") ?? rail;
          // pinSpacing must be explicit: the landing column is a flex container, where ScrollTrigger defaults it to false.
          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: pin
              ? { trigger: section, start: "top 56px", end: () => `+=${Math.round(window.innerHeight * 0.9)}`, pin: true, pinSpacing: true, scrub: LANDING_MOTION.scrub }
              : { trigger: rail, start: "top 75%", end: "bottom 55%", scrub: LANDING_MOTION.scrub },
          });
          tl.fromTo(rail.querySelector("[data-rail-fill]"), wide ? { scaleX: 0 } : { scaleY: 0 }, { scaleX: 1, scaleY: 1, duration: steps.length - 0.5 }, 0);
          steps.forEach((step, i) => {
            tl.fromTo(step, { opacity: LANDING_MOTION.restingStepOpacity }, { opacity: 1, duration: 0.4, ease: LANDING_MOTION.stepEase }, i * 0.95);
            tl.fromTo(step.querySelector("[data-rail-dot]"), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: LANDING_MOTION.stepEase }, i * 0.95);
          });
        }
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
