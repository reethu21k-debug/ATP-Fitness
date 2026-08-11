import { Card, CardContent } from "@/components/ui/card";

const VALUES = [
  { title: "Coaching, not just equipment", desc: "Anyone can rent floor space. Our trainers actually adjust your plan based on what's working — every two weeks, not once at signup." },
  { title: "No pressure, no upselling", desc: "You'll never be talked into a plan you don't need. Try the floor free, then decide." },
  { title: "A gym you can actually track", desc: "Workouts, diet, and attendance — all visible to you and your trainer in the members app, not locked in a notebook at the front desk." },
];

const STATS = [
  { value: "[20XX]", label: "Founded" },
  { value: "500+", label: "Members" },
  { value: "12", label: "Trainers" },
];

export const metadata = { title: "About — ATP Fitness" };

export default function AboutPage() {
  return (
    <div className="container px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Train different</h1>
        <p className="mt-4 text-muted-foreground">
          ATP Fitness is a strength and conditioning gym in Anantapur, built for
          people who want real coaching, not just a card swipe and an empty rack.
          [Placeholder — replace with ATP Fitness's actual founding story.]
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-md grid-cols-3 gap-6 border-y py-8 text-center">
        {STATS.map((s) => (
          <div key={s.label}>
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-20 grid gap-6 sm:grid-cols-3">
        {VALUES.map((v) => (
          <Card key={v.title}>
            <CardContent className="p-6">
              <h3 className="font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
