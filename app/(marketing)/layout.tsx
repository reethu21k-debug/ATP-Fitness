import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0C] text-[#F5F3EE] font-sans antialiased">
      {/*
        Gym-vibe type system, loaded once here so every page under /marketing
        can use it:
          .font-display    -> Anton          (huge stadium-signage headlines)
          .font-eyebrow    -> Oswald         (condensed labels, tags, nav)
          .font-mono-score -> JetBrains Mono (scoreboard digits, stats, data)
        Body copy stays on the default font-sans (e.g. Inter) for readability.
      */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Oswald:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
        .font-display { font-family: 'Anton', sans-serif; }
        .font-eyebrow { font-family: 'Oswald', sans-serif; letter-spacing: 0.08em; }
        .font-mono-score { font-family: 'JetBrains Mono', monospace; }
      `}</style>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}