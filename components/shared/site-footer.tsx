import Link from "next/link";
import Image from "next/image";

const COLUMNS = [
  {
    tag: "01",
    title: "Gym",
    links: [
      { href: "/features", label: "Facilities & classes" },
      { href: "/pricing", label: "Membership plans" },
      { href: "/gallery", label: "Gallery" },
    ],
  },
  {
    tag: "02",
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/testimonials", label: "Member stories" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    tag: "03",
    title: "Members",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/contact", label: "Book a free trial" },
    ],
  },
  {
    tag: "04",
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0A0A0C] text-[#F5F3EE]">
      {/* Sideline stripe, mirrored from the header, so the shell reads as one facility */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#E8262A] via-[#F2B705] to-[#E8262A]" />

      <div className="container grid gap-12 py-16 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="ATP Fitness"
              width={1350}
              height={901}
              className="h-14 w-auto"
            />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#8E8E9A]">
            TCR Towers, 15/704, Main Rd, near Mayur Lodge, Kamalanagar, Anantapur, Andhra Pradesh 515001. Strength training, group classes, and personal coaching — open every day.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="flex items-center gap-2 font-eyebrow text-xs font-semibold uppercase tracking-widest text-[#F5F3EE]">
              <span className="font-mono-score text-[10px] text-[#E8262A]">{col.tag}</span>
              {col.title}
            </h4>
            <ul className="mt-4 space-y-3">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#8E8E9A] transition-colors hover:text-[#F2B705]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="container flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 sm:flex-row">
        <p className="font-mono-score text-xs text-[#6E6E7A]">
          © {new Date().getFullYear()} ATP Fitness. All rights reserved.
        </p>
        <p className="font-eyebrow text-xs font-semibold uppercase tracking-widest text-[#F2B705]">
          Train Different.
        </p>
      </div>
    </footer>
  );
}