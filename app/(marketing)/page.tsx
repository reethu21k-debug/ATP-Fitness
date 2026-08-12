import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BannerCarousel } from "@/components/features/marketing/banner-carousel";
import {
  ArrowRight,
  CheckCircle2,
  Quote,
  Flame,
  Timer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/* ---------------------------------------------------------------------- */
/*  Content                                                                */
/* ---------------------------------------------------------------------- */

// Scoreboard readout — three numbers, read like a gym's digital clock.
const SCOREBOARD = [
  { value: "500", suffix: "+", label: "Athletes training with us" },
  { value: "12", suffix: "", label: "Coaches on the floor" },
  { value: "18", suffix: "HR", label: "Open daily · 5AM – 11PM" },
];

// Roster grid — six lockers, six pre-designed cards (image-based).
const ROSTER = [
  { locker: "01", image: "/Home/Card1.png", alt: "Strength & Conditioning Floor" },
  { locker: "02", image: "/Home/Card2.png", alt: "Cardio Zone" },
  { locker: "03", image: "/Home/Card3.png", alt: "Elite Personal Training" },
  { locker: "04", image: "/Home/Card4.png", alt: "Instant QR Check-In" },
  { locker: "05", image: "/Home/Card5.png", alt: "Transparent, Simple Billing" },
  { locker: "06", image: "/Home/Card6.png", alt: "Data-Driven Progress" },
];

// The load-in — three plates loaded onto the bar, heaviest to lightest.
const LOAD_IN = [
  {
    plate: "25",
    size: "h-36 w-36 sm:h-40 sm:w-40",
    step: "Book In",
    detail: "Walk in or fill out the contact form — we'll set up a facility tour and a free first session.",
  },
  {
    plate: "20",
    size: "h-28 w-28 sm:h-32 sm:w-32",
    step: "Pick Your Plan",
    detail: "Choose monthly, quarterly, or annual tiers. Bolt on personal training or class packs anytime.",
  },
  {
    plate: "15",
    size: "h-20 w-20 sm:h-24 sm:w-24",
    step: "Load & Go",
    detail: "Scan the QR at the desk. Your trainer instantly reviews attendance and adjusts your program.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#F5F3EE] selection:bg-[#E8262A] selection:text-white font-sans antialiased">
      <BannerCarousel />

      {/* ================================================================ */}
      {/*  HERO — the opening whistle                                      */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="pointer-events-none absolute top-1/4 left-1/2 -z-10 h-[550px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-[#E8262A]/15 via-[#F2B705]/5 to-transparent blur-[140px]" />

        <div className="container mx-auto px-6 text-center">
          {/* Ticket-stub badge, torn edge via dashed border + notch shadows */}
          <div className="relative mx-auto inline-flex items-center gap-3 rounded-md border border-dashed border-[#F2B705]/50 bg-[#151518] px-5 py-2 font-eyebrow text-xs font-semibold uppercase text-[#F2B705]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F2B705] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#F2B705]" />
            </span>
            Admit One — Free Trial Session
          </div>

          <h1 className="font-display mx-auto mt-9 max-w-5xl text-6xl uppercase leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
            Train
            <span className="text-[#E8262A]"> Different.</span>
            <br />
            <span className="text-[#F5F3EE]/90">Anantapur&apos;s Elite </span>
            <span className="bg-gradient-to-r from-[#E8262A] to-[#F2B705] bg-clip-text text-transparent">
              Strength Floor.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#A6A6AF] sm:text-xl">
            An uncompromising strength floor, high-octane group classes, and certified coaching — backed by a member app that logs every rep, meal, and milestone.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="h-14 w-full rounded-md bg-[#E8262A] px-8 font-eyebrow text-base font-bold uppercase tracking-wide text-white shadow-[0_0_35px_-5px_rgba(232,38,42,0.55)] transition-all duration-300 hover:scale-[1.02] hover:bg-[#FF3236] sm:w-auto"
              asChild
            >
              <Link href="/contact" className="flex items-center gap-2">
                Book a Free Trial <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 w-full rounded-md border-white/15 bg-transparent px-8 font-eyebrow text-base font-semibold uppercase tracking-wide text-[#F5F3EE] transition-all duration-300 hover:border-[#F2B705]/60 hover:bg-[#151518] hover:text-[#F2B705] sm:w-auto"
              asChild
            >
              <Link href="/pricing">See Membership Plans</Link>
            </Button>
          </div>

          <p className="mt-5 font-eyebrow text-xs uppercase text-[#6E6E7A]">
            No joining fee this month · Drop in anytime for a guided tour
          </p>

          {/* Scoreboard readout, standing in for a stats bar */}
          <div className="mx-auto mt-16 max-w-4xl rounded-lg border border-white/10 bg-[#101012] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-2.5">
              <span className="font-eyebrow text-[11px] uppercase text-[#6E6E7A]">ATP Fitness — Live Board</span>
              <span className="flex items-center gap-1.5 font-mono-score text-[11px] text-[#F2B705]">
                <Timer className="h-3.5 w-3.5" /> Today
              </span>
            </div>
            <div className="grid grid-cols-1 gap-6 divide-y divide-white/10 p-8 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {SCOREBOARD.map((m) => (
                <div key={m.label} className="flex flex-col items-center pt-6 first:pt-0 sm:pt-0">
                  <p className="font-mono-score text-5xl font-bold tracking-tight text-[#E8262A] [text-shadow:0_0_20px_rgba(232,38,42,0.45)] sm:text-6xl">
                    {m.value}
                    <span className="text-2xl text-[#F5F3EE]/70 sm:text-3xl">{m.suffix}</span>
                  </p>
                  <p className="mt-2 text-center font-eyebrow text-xs uppercase text-[#8E8E9A]">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  ROSTER — six lockers, six pre-designed image cards              */}
      {/* ================================================================ */}
      <section className="relative border-t border-white/10 bg-[#0A0A0C] py-24">
        <div className="container mx-auto px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-3 font-eyebrow text-xs uppercase text-[#E8262A]">The ATP Roster</div>
            <h2 className="font-display text-4xl uppercase tracking-tight sm:text-6xl">
              Everything On The Floor
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#A6A6AF]">
              No fluff. World-class equipment, data-driven accountability, and coaching that shows up — filed six lockers deep.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ROSTER.map((f) => (
              <div
                key={f.locker}
                className="group relative aspect-[3/2] overflow-hidden rounded-xl border border-white/10 bg-[#131316] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#E8262A]/50 hover:shadow-[0_18px_40px_-12px_rgba(232,38,42,0.3)]"
              >
                <Image
                  src={f.image}
                  alt={f.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  // Slight overscale + centered crop trims the source PNG's
                  // own dark margin so no letterboxing/black bars show inside
                  // the rounded card frame.
                  className="scale-[1.06] object-cover object-center"
                  priority={f.locker === "01"}
                />
                {/* subtle inner ring so the crop edge always reads intentional */}
                <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 group-hover:ring-[#E8262A]/40" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  THE LOAD-IN — workflow as a barbell being loaded                */}
      {/* ================================================================ */}
      <section className="relative border-y border-white/10 bg-[#111114] py-28">
        <div className="container mx-auto px-6">
          <div className="mx-auto mb-20 max-w-2xl text-center">
            <div className="mb-3 font-eyebrow text-xs uppercase text-[#F2B705]">The Load-In</div>
            <h2 className="font-display text-4xl uppercase tracking-tight sm:text-5xl">
              Three Plates. Zero Friction.
            </h2>
            <p className="mt-3 text-[#A6A6AF]">
              Same bar, heaviest step first — here's exactly what loading in looks like.
            </p>
          </div>

          {/* The bar */}
          <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-16 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 hidden h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#3A3A42] via-[#54545C] to-[#3A3A42] sm:block" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-2 -translate-x-1/2 rounded-full bg-gradient-to-b from-[#3A3A42] via-[#54545C] to-[#3A3A42] sm:hidden" />

            {LOAD_IN.map((p, i) => (
              <div key={p.step} className="relative z-10 flex flex-col items-center text-center sm:w-1/3">
                {/* Weight plate */}
                <div
                  className={`${p.size} flex items-center justify-center rounded-full border-4 border-[#E8262A]/80 bg-[#0A0A0C] shadow-[0_0_30px_-8px_rgba(232,38,42,0.5)]`}
                >
                  <div className="flex h-1/2 w-1/2 items-center justify-center rounded-full border-2 border-[#3A3A42] bg-[#141417]">
                    <span className="font-mono-score text-xl font-bold text-[#F2B705] sm:text-2xl">{p.plate}</span>
                  </div>
                </div>
                <span className="mt-2 font-mono-score text-[10px] uppercase tracking-widest text-[#6E6E7A]">
                  Set 0{i + 1}
                </span>
                <h3 className="font-eyebrow mt-3 text-xl font-semibold uppercase tracking-wide text-[#F5F3EE]">
                  {p.step}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#8E8E9A]">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  PR CARD — social proof as a personal-record chalkboard          */}
      {/* ================================================================ */}
      <section className="container mx-auto px-6 py-24">
        <Card className="relative overflow-hidden rounded-2xl border border-[#F2B705]/25 bg-[#131316] p-10 shadow-[0_0_60px_-20px_rgba(242,183,5,0.2)] sm:p-14">
          {/* Diagonal PR stamp */}
          <div className="absolute -right-10 -top-6 rotate-12 rounded-md border-2 border-[#E8262A] px-4 py-1 font-eyebrow text-sm font-bold uppercase tracking-widest text-[#E8262A] opacity-90">
            New PR
          </div>

          <CardContent className="relative z-10 flex flex-col gap-6 p-0 sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#F2B705]/30 bg-[#0A0A0C] text-[#F2B705]">
                <Quote className="h-7 w-7" />
              </div>
            </div>

            <div className="flex-1">
              <blockquote className="font-eyebrow text-xl font-medium leading-relaxed text-[#F5F3EE] sm:text-2xl">
                &ldquo;Six months in and I&apos;ve dropped 8kg. My trainer adjusts my plan every two weeks based on what&apos;s actually working. The atmosphere here is unmatched.&rdquo;
              </blockquote>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <div>
                  <p className="font-eyebrow font-bold uppercase tracking-wide text-[#F2B705]">Karthik R.</p>
                  <p className="font-mono-score text-xs uppercase tracking-widest text-[#6E6E7A]">
                    Verified Member · Anantapur
                  </p>
                </div>
                <span className="hidden h-6 w-px bg-white/10 sm:block" />
                <div className="flex items-center gap-1.5 font-mono-score text-xs text-[#8E8E9A]">
                  <Flame className="h-3.5 w-3.5 text-[#E8262A]" /> −8KG in 6 months
                </div>
              </div>

              <Button
                variant="outline"
                className="mt-6 rounded-md border-white/15 bg-transparent px-6 font-eyebrow text-sm font-semibold uppercase tracking-wide text-[#F5F3EE] transition-all hover:border-[#E8262A] hover:bg-[#E8262A]/10 hover:text-[#F2B705]"
                asChild
              >
                <Link href="/testimonials">Read More Transformations</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ================================================================ */}
      {/*  FINAL CTA — on your marks, hazard-tape floor line               */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden pb-28 pt-10">
        <div className="container mx-auto px-6">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#111114] shadow-2xl">
            {/* Hazard-stripe floor tape along the top edge */}
            <div
              className="h-2.5 w-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, #F2B705 0 14px, #0A0A0C 14px 28px)",
              }}
            />
            <div className="relative p-10 text-center sm:p-16">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(232,38,42,0.18),transparent_70%)]" />

              <div className="mb-3 font-eyebrow text-xs uppercase text-[#F2B705]">On Your Marks</div>
              <h2 className="font-display text-4xl uppercase tracking-tight sm:text-6xl">
                Ready To Commit?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#A6A6AF]">
                Step onto the floor for a free trial session. Test the equipment, feel the culture, meet your future coaches — zero pressure.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  className="h-14 w-full rounded-md bg-[#E8262A] px-10 font-eyebrow text-base font-bold uppercase tracking-wide text-white shadow-[0_0_35px_-5px_rgba(232,38,42,0.55)] transition-all duration-300 hover:scale-[1.02] hover:bg-[#FF3236] sm:w-auto"
                  asChild
                >
                  <Link href="/contact" className="flex items-center gap-2">
                    Claim Your Free Trial <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 font-eyebrow text-sm uppercase text-[#8E8E9A]">
                <CheckCircle2 className="h-4 w-4 text-[#E8262A]" />
                <span>No joining fee this month · Cancel or freeze anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}