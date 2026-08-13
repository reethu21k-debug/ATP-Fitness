"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Banner images live directly in /public at 2172x724px (3:1 ratio).
const BANNERS = [
  { src: "/banner-1.png", alt: "ATP Fitness banner 1", href: "" },
  { src: "/banner-2.png", alt: "ATP Fitness banner 2", href: "" },
  { src: "/banner-3.png", alt: "ATP Fitness banner 3", href: "" },
  { src: "/banner-4.png", alt: "ATP Fitness banner 4", href: "" },
  { src: "/banner-5.png", alt: "ATP Fitness banner 5", href: "" },
  { src: "/banner-6.png", alt: "ATP Fitness banner 6", href: "" },
  { src: "/banner-7.png", alt: "ATP Fitness banner 7", href: "" },
  { src: "/banner-8.png", alt: "ATP Fitness banner 8", href: "" },
  { src: "/banner-9.png", alt: "ATP Fitness banner 9", href: "" },
  { src: "/banner-10.png", alt: "ATP Fitness banner 10", href: "" },
  { src: "/banner-11.png", alt: "ATP Fitness banner 11", href: "" },
  { src: "/banner-12.png", alt: "ATP Fitness banner 12", href: "" },
  { src: "/banner-13.png", alt: "ATP Fitness banner 13", href: "" },
  { src: "/banner-14.png", alt: "ATP Fitness banner 14", href: "" },
  { src: "/banner-15.png", alt: "ATP Fitness banner 15", href: "" },
  { src: "/banner-16.png", alt: "ATP Fitness banner 16", href: "" },
  { src: "/banner-17.png", alt: "ATP Fitness banner 17", href: "" },
];

const AUTOPLAY_MS = 4500;

export function BannerCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((i: number) => {
    setIndex((i + BANNERS.length) % BANNERS.length);
  }, []);

  useEffect(() => {
    if (BANNERS.length <= 1 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % BANNERS.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <section
      className="relative w-full overflow-hidden bg-[#0A0A0C]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[3/1] w-full">
        {BANNERS.map((banner, i) => {
          const content = (
            <Image
              src={banner.src}
              alt={banner.alt}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
          );
          return (
            <div
              key={banner.src}
              className="absolute inset-0 transition-opacity duration-500"
              style={{ opacity: i === index ? 1 : 0, pointerEvents: i === index ? "auto" : "none" }}
              aria-hidden={i !== index}
            >
              {banner.href ? (
                <a href={banner.href} className="block h-full w-full">
                  {content}
                </a>
              ) : (
                content
              )}
              {/* Vignette so scoreboard chrome stays legible over any artwork */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            </div>
          );
        })}

        {BANNERS.length > 1 && (
          <>
            {/* Scoreboard slide counter, top-left, bolted-on-clock style */}
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-sm border border-[#F2B705]/40 bg-[#0A0A0C]/85 px-3 py-1.5 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8262A]" />
              <span className="font-mono-score text-xs font-semibold tracking-wider text-[#F2B705]">
                {String(index + 1).padStart(2, "0")}
                <span className="text-[#F5F3EE]/50"> / {String(BANNERS.length).padStart(2, "0")}</span>
              </span>
            </div>

            {/* Squared, rack-style prev/next controls */}
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous banner"
              className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-sm border border-white/15 bg-[#0A0A0C]/70 text-[#F5F3EE] backdrop-blur-sm transition hover:border-[#E8262A]/70 hover:bg-[#E8262A]/20 hover:text-[#F2B705]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next banner"
              className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-sm border border-white/15 bg-[#0A0A0C]/70 text-[#F5F3EE] backdrop-blur-sm transition hover:border-[#E8262A]/70 hover:bg-[#E8262A]/20 hover:text-[#F2B705]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}