"use client";

import { useEffect, useState } from "react";

const DISPLAY_MS = 4600;
const FADE_MS = 500;

export function Preloader() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const fadeTimer = setTimeout(() => setFading(true), DISPLAY_MS);
    const removeTimer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = "";
    }, DISPLAY_MS + FADE_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
      document.body.style.overflow = "";
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity ease-out"
      style={{
        opacity: fading ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
        pointerEvents: fading ? "none" : "auto",
      }}
      aria-hidden={fading}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/preloader.gif"
        alt="ATP Fitness loading"
        className="object-contain"
        style={{ width: "clamp(260px, 32vw, 620px)", height: "clamp(260px, 32vw, 620px)" }}
      />
    </div>
  );
}