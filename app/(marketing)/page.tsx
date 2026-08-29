import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BannerCarousel } from "@/components/features/marketing/banner-carousel";
import {
  ArrowRight,
  CheckCircle2,
  Quote,
  Flame,
  Dumbbell,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/* ---------------------------------------------------------------------- */
/*  Content                                                                */
/* ---------------------------------------------------------------------- */

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
    size: "h-28 w-28 sm:h-40 sm:w-40",
    step: "Book In",
    detail: "Walk in or fill out the contact form — we'll set up a facility tour and a free first session.",
  },
  {
    plate: "20",
    size: "h-24 w-24 sm:h-32 sm:w-32",
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
      {/*  HERO — redesigned: asymmetric layout, tighter type scale,       */}
      {/*  and a "locker tag" scoreboard as the signature element.         */}
      {/*  Same palette + font families as the rest of the page.           */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden border-b border-white/10 pt-14 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
        {/* ambient glow, shifted off-center to sit behind the locker tag */}
        <div className="pointer-events-none absolute right-[-10%] top-[-10%] -z-10 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-[#E8262A]/20 via-[#F2B705]/8 to-transparent blur-[110px] sm:h-[600px] sm:w-[600px]" />

        <div className="container mx-auto grid grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
          {/* ------------------------------------------------------------ */}
          {/*  LEFT — copy, left-aligned, tighter type scale               */}
          {/* ------------------------------------------------------------ */}
          <div className="text-center lg:text-left">
            <div className="relative mx-auto inline-flex items-center gap-2.5 rounded-md border border-dashed border-[#F2B705]/50 bg-[#151518] px-4 py-1.5 font-eyebrow text-[11px] font-semibold uppercase text-[#F2B705] lg:mx-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F2B705] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#F2B705]" />
              </span>
              Admit One — Free Trial Session
            </div>

            <h1 className="font-display mx-auto mt-7 max-w-xl text-4xl uppercase leading-[0.98] tracking-tight sm:text-6xl lg:mx-0 lg:text-6xl xl:text-7xl">
              Train
              <span className="text-[#E8262A]"> Different.</span>
              <br />
              <span className="text-[#F5F3EE]/90">Anantapur&apos;s Elite</span>
              <br />
              <span className="bg-gradient-to-r from-[#E8262A] to-[#F2B705] bg-clip-text text-transparent">
                Strength Floor.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-[#A6A6AF] sm:text-base lg:mx-0">
              An uncompromising strength floor, high-octane group classes, and certified coaching — backed by a member app that logs every rep, meal, and milestone.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Button
                size="lg"
                className="h-12 w-full rounded-md bg-[#E8262A] px-7 font-eyebrow text-sm font-bold uppercase tracking-wide text-white shadow-[0_0_30px_-5px_rgba(232,38,42,0.55)] transition-all duration-300 hover:scale-[1.02] hover:bg-[#FF3236] sm:w-auto"
                asChild
              >
                <Link href="/contact" className="flex items-center gap-2">
                  Book a Free Trial <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-md border-white/15 bg-transparent px-7 font-eyebrow text-sm font-semibold uppercase tracking-wide text-[#F5F3EE] transition-all duration-300 hover:border-[#F2B705]/60 hover:bg-[#151518] hover:text-[#F2B705] sm:w-auto"
                asChild
              >
                <Link href="/pricing">See Membership Plans</Link>
              </Button>
            </div>

            <p className="mx-auto mt-8 max-w-md font-eyebrow text-xs uppercase tracking-widest text-[#6E6E7A] lg:mx-0">
              Drop in anytime for a guided tour of the floor
            </p>
          </div>

          {/* ------------------------------------------------------------ */}
          {/*  RIGHT — signature element: a laminated "locker tag" card     */}
          {/*  reading like a member ID pulled off the gym floor, angled    */}
          {/*  slightly so it feels dropped-in rather than templated.       */}
          {/* ------------------------------------------------------------ */}
          <div className="mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
            <div className="relative -rotate-2 rounded-2xl border border-white/10 bg-[#131316] p-6 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.7)] transition-transform duration-500 hover:rotate-0 sm:p-8">
              {/* punch hole + lanyard notch, sells the "tag" idea */}
              <div className="absolute left-1/2 top-3 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#0A0A0C] ring-1 ring-white/10" />

              <div className="flex items-center justify-between border-b border-dashed border-white/15 pb-4">
                <span className="font-eyebrow text-[10px] font-semibold uppercase tracking-widest text-[#6E6E7A]">
                  Locker Tag
                </span>
                <span className="font-mono-score text-[10px] uppercase tracking-widest text-[#F2B705]">
                  ATP · 001
                </span>
              </div>

              <div className="flex items-center gap-4 py-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[#E8262A]/70 bg-[#0A0A0C]">
                  <Dumbbell className="h-6 w-6 text-[#E8262A]" />
                </div>
                <div>
                  <p className="font-eyebrow text-lg font-bold uppercase leading-tight text-[#F5F3EE]">
                    First Session
                  </p>
                  <p className="font-mono-score text-xs uppercase tracking-widest text-[#6E6E7A]">
                    On the house
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0A0A0C] px-4 py-3">
                <div className="flex items-center gap-2 font-mono-score text-xs uppercase tracking-widest text-[#8E8E9A]">
                  <Zap className="h-3.5 w-3.5 text-[#F2B705]" /> Status
                </div>
                <span className="font-eyebrow text-xs font-bold uppercase tracking-wide text-[#F2B705]">
                  Open Today
                </span>
              </div>

              <p className="mt-5 text-center font-eyebrow text-[11px] uppercase tracking-widest text-[#6E6E7A]">
                Certified coaches, every session
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  ROSTER — six lockers, six pre-designed image cards              */}
      {/* ================================================================ */}
      <section className="relative border-t border-white/10 bg-[#0A0A0C] py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-16">
            <div className="mb-3 font-eyebrow text-xs uppercase text-[#E8262A]">The ATP Roster</div>
            <h2 className="font-display text-3xl uppercase tracking-tight sm:text-4xl lg:text-6xl">
              Everything On The Floor
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#A6A6AF] sm:text-base">
              No fluff. World-class equipment, data-driven accountability, and coaching that shows up — filed six lockers deep.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
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
      <section className="relative border-y border-white/10 bg-[#111114] py-16 sm:py-20 lg:py-28">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-20">
            <div className="mb-3 font-eyebrow text-xs uppercase text-[#F2B705]">The Load-In</div>
            <h2 className="font-display text-3xl uppercase tracking-tight sm:text-4xl lg:text-5xl">
              Three Plates. Zero Friction.
            </h2>
            <p className="mt-3 text-sm text-[#A6A6AF] sm:text-base">
              Same bar, heaviest step first — here's exactly what loading in looks like.
            </p>
          </div>

          {/* The bar */}
          <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-12 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
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
      <section className="container mx-auto px-4 py-16 sm:px-6 sm:py-24">
        <Card className="relative overflow-hidden rounded-2xl border border-[#F2B705]/25 bg-[#131316] p-6 shadow-[0_0_60px_-20px_rgba(242,183,5,0.2)] sm:p-10 lg:p-14">
          {/* Diagonal PR stamp */}
          <div className="absolute -right-6 -top-5 rotate-12 rounded-md border-2 border-[#E8262A] px-3 py-1 font-eyebrow text-xs font-bold uppercase tracking-widest text-[#E8262A] opacity-90 sm:-right-10 sm:-top-6 sm:px-4 sm:text-sm">
            New PR
          </div>

          <CardContent className="relative z-10 flex flex-col gap-6 p-0 sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#F2B705]/30 bg-[#0A0A0C] text-[#F2B705]">
                <Quote className="h-7 w-7" />
              </div>
            </div>

            <div className="flex-1">
              <blockquote className="font-eyebrow text-lg font-medium leading-relaxed text-[#F5F3EE] sm:text-xl lg:text-2xl">
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
      <section className="relative overflow-hidden pb-16 pt-8 sm:pb-28 sm:pt-10">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#111114] shadow-2xl">
            {/* Hazard-stripe floor tape along the top edge */}
            <div
              className="h-2.5 w-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, #F2B705 0 14px, #0A0A0C 14px 28px)",
              }}
            />
            <div className="relative p-6 text-center sm:p-10 lg:p-16">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(232,38,42,0.18),transparent_70%)]" />

              <div className="mb-3 font-eyebrow text-xs uppercase text-[#F2B705]">On Your Marks</div>
              <h2 className="font-display text-3xl uppercase tracking-tight sm:text-4xl lg:text-6xl">
                Ready To Commit?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[#A6A6AF] sm:text-base">
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
                <span> Join the fitness journey Today </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}