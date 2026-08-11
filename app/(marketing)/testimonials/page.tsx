import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

// Placeholder testimonials — replace with real ATP Fitness member quotes & photos.
const TESTIMONIALS = [
  { name: "[Member name]", role: "Member since [month, year]", quote: "Six months in and I've dropped 8kg. My trainer actually adjusts my plan every couple of weeks based on what's working." },
  { name: "[Member name]", role: "Personal training client", quote: "I tried three gyms before this one. The difference is the coaching — someone actually watches your form here." },
  { name: "[Member name]", role: "Group class regular", quote: "The 6 AM HIIT class is the only reason I get up on time. Great energy, never feels crowded." },
  { name: "[Member name]", role: "Member since [month, year]", quote: "Checking in with the QR code and seeing my attendance streak in the app keeps me honest about showing up." },
  { name: "[Member name]", role: "Weight-loss program", quote: "The diet plan was realistic, not some copy-pasted PDF. My trainer actually asked what I could stick to." },
  { name: "[Member name]", role: "Member since [month, year]", quote: "Clean equipment, no waiting for machines, and the front desk actually remembers your name." },
];

export const metadata = { title: "Member Stories — ATP Fitness" };

export default function TestimonialsPage() {
  return (
    <div className="container px-6 py-20">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Member stories</h1>
        <p className="mt-4 text-muted-foreground">Placeholder quotes — swap in real ATP Fitness member testimonials and photos.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex gap-0.5 text-warning">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground">"{t.quote}"</p>
              <div className="mt-4 border-t pt-4">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
