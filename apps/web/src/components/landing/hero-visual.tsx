import Image from "next/image";
import type { ReactNode } from "react";
import { ESRI_ATTRIBUTION } from "../../lib/map";

/**
 * The two sample fields of public/samples/demo-fields.geojson, projected into the pixel space of
 * public/landing/kostanay-fields.webp (Esri World Imagery, zoom 15, 1280×959, west 63.780, north 53.2468,
 * east 63.848, south 53.2163). Regenerate both together if the sample fields move.
 */
export const HERO_IMAGE = { src: "/landing/kostanay-fields.webp", width: 1280, height: 959 } as const;
export const HERO_FIELDS = [
  { name: "Demo field A", d: "M388.5 114.5 L1144.7 324.6 L1072 591.2 L191.4 357 L243.2 279.3 Z", delay: 200 },
  { name: "Demo field B", d: "M142.9 502.2 L954 699.4 L929.7 828.6 L122 650.9 Z", delay: 550 },
] as const;

/**
 * Hero proof visual: sample fields drawing themselves over satellite imagery, then the live pool card
 * rising over the image's lower edge. The motion is CSS (globals.css, "Hero intro") so it starts with the
 * first paint, needs no hydration and shows the end state when animations are off.
 */
export function HeroVisual({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <figure className="relative overflow-hidden rounded-lg border border-border bg-card">
        <Image
          src={HERO_IMAGE.src}
          width={HERO_IMAGE.width}
          height={HERO_IMAGE.height}
          alt="Satellite view of two sample wheat fields about 12 km east of Kostanay, Kazakhstan, outlined in wheat yellow"
          preload
          unoptimized
          sizes="(min-width: 1024px) 540px, 100vw"
          className="h-auto w-full brightness-[0.82] saturate-[0.85]"
        />
        <svg viewBox={`0 0 ${HERO_IMAGE.width} ${HERO_IMAGE.height}`} aria-hidden className="absolute inset-0 size-full">
          {HERO_FIELDS.map((f) => (
            <g key={f.name}>
              <path d={f.d} className="hero-field-fill" style={{ animationDelay: `${f.delay + 600}ms` }} />
              <path d={f.d} pathLength={1} className="hero-field-casing" style={{ animationDelay: `${f.delay}ms` }} />
              <path d={f.d} pathLength={1} className="hero-field-line" style={{ animationDelay: `${f.delay}ms` }} />
            </g>
          ))}
        </svg>
        {/* Darkens the lower edge so the rising card separates from bright imagery. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-background/85 to-transparent" />
        <figcaption className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] rounded-md bg-background/80 px-2 py-1 text-xs text-foreground backdrop-blur-sm">
          Sample fields near Kostanay · {ESRI_ATTRIBUTION}
        </figcaption>
      </figure>
      <div data-intro className="hero-card relative z-10 -mt-10 px-3 sm:-mt-24 sm:px-6">
        {children}
      </div>
    </div>
  );
}
