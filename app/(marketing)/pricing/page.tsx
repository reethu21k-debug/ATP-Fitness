import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const PLANS = [
  {
    name: "Monthly", price: "₹1,999", period: "/month", branches: "Full gym access, no lock-in",
    features: ["Strength floor & cardio zone", "All group classes", "1 free trainer assessment", "QR check-in & members app"],
    highlighted: false,
  },
  {
    name: "Quarterly", price: "₹4,999", period: "/3 months", branches: "Best for building a habit",
    features: ["Everything in Monthly", "1 free personal training session/month", "Diet plan from a staff trainer", "Priority class booking"],
    highlighted: true,
  },
  {
    name: "Annual", price: "₹16,999", period: "/year", branches: "Our best value plan",
    features: ["Everything in Quarterly", "2 free PT sessions/month", "Free supplement starter kit", "1 free guest pass/month"],
    highlighted: false,
  },
];

const FAQS = [
  { q: "Is there a free trial?", a: "Yes — walk in any day for a free trial session before you commit to a plan." },
  { q: "Can I upgrade my plan later?", a: "Yes, you can switch to a longer plan any time at the front desk; we'll prorate the difference." },
  { q: "Do you offer personal training separately?", a: "Yes, PT packs can be added to any membership — ask at the front desk for current rates." },
  { q: "Is there a joining fee?", a: "No joining fee this month. Ask at the front desk for current offers." },
];

export const metadata = { title: "Membership Plans — ATP Fitness" };

export default function PricingPage() {
  return (
    <div className="container px-6 py-20">
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Membership plans</h1>
        <p className="mt-4 text-muted-foreground">Straightforward pricing. No per-class fees, no hidden charges.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={cn("relative flex flex-col", plan.highlighted && "border-primary shadow-lg ring-1 ring-primary")}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Most popular
              </span>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <div className="flex items-baseline gap-1 pt-2">
                <span className="text-3xl font-semibold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <p className="text-sm text-muted-foreground">{plan.branches}</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ul className="flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-6 w-full" variant={plan.highlighted ? "default" : "outline"} asChild>
                <Link href="/contact">Book a free trial</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-24 max-w-2xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-8 divide-y">
          {FAQS.map((f) => (
            <div key={f.q} className="py-5">
              <h3 className="font-medium">{f.q}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
