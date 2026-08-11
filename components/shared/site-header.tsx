"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/gallery", label: "Gallery" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0A0C]/90 backdrop-blur-md">
      {/* Thin sideline stripe — a court/track marking, not a decoration */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#E8262A] via-[#F2B705] to-[#E8262A]" />

      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="ATP Fitness"
            width={1350}
            height={901}
            priority
            className="h-12 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative font-eyebrow text-xs font-semibold uppercase tracking-widest text-[#A6A6AF] transition-colors hover:text-[#F5F3EE]"
            >
              {link.label}
              <span className="absolute -bottom-1.5 left-0 h-[2px] w-0 bg-[#E8262A] transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            className="font-eyebrow text-xs font-semibold uppercase tracking-wide text-[#F5F3EE] hover:bg-white/5 hover:text-[#F2B705]"
            asChild
          >
            <Link href="/login">Sign In</Link>
          </Button>
          <Button
            className="rounded-md bg-[#E8262A] font-eyebrow text-xs font-bold uppercase tracking-wide text-white shadow-[0_0_20px_-6px_rgba(232,38,42,0.6)] hover:bg-[#FF3236]"
            asChild
          >
            <Link href="/contact">Book a Free Trial</Link>
          </Button>
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-[#F5F3EE] md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-dashed border-white/15 bg-[#0A0A0C] px-6 py-5 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-md px-2 py-3 font-eyebrow text-sm font-semibold uppercase tracking-wide text-[#F5F3EE] transition-colors hover:bg-white/5 hover:text-[#F2B705]"
                onClick={() => setOpen(false)}
              >
                <span className="font-mono-score text-xs text-[#6E6E7A]">{String(i + 1).padStart(2, "0")}</span>
                {link.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
              <Button
                variant="outline"
                className="rounded-md border-white/15 font-eyebrow text-xs font-semibold uppercase tracking-wide text-[#F5F3EE] hover:border-[#F2B705]/60 hover:text-[#F2B705]"
                asChild
              >
                <Link href="/login">Sign In</Link>
              </Button>
              <Button
                className="rounded-md bg-[#E8262A] font-eyebrow text-xs font-bold uppercase tracking-wide text-white hover:bg-[#FF3236]"
                asChild
              >
                <Link href="/contact">Book a Free Trial</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}