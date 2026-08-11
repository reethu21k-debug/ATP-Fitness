import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

const VALUES = [
  { title: "Coaching, not just equipment", desc: "Anyone can rent floor space. Our trainers actually adjust your plan based on what's working — every two weeks, not once at signup." },
  { title: "No pressure, no upselling", desc: "You'll never be talked into a plan you don't need. Try the floor free, then decide." },
  { title: "A gym you can actually track", desc: "Workouts, diet, and attendance — all visible to you and your trainer in the members app, not locked in a notebook at the front desk." },
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

      <div className="mx-auto mt-14 flex max-w-xs items-center justify-center gap-3 rounded-full border bg-card px-6 py-3 text-center shadow-sm">
        <Clock className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm">
          <span className="font-semibold">Open daily</span>
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span className="text-muted-foreground">5AM – 11PM</span>
        </p>
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