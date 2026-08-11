import { Card, CardContent } from "@/components/ui/card";
import {
  Dumbbell, Users, HeartPulse, Utensils, QrCode, MessagesSquare,
  Boxes, ShowerHead, ParkingCircle, ShieldCheck, Trophy, Smartphone,
} from "lucide-react";

const MODULES = [
  {
    icon: Dumbbell, title: "Strength floor",
    items: ["Free weights, plate-loaded machines & racks", "Olympic lifting platforms", "Functional training rig & turf"],
  },
  {
    icon: Users, title: "Group classes",
    items: ["HIIT & functional circuits", "Yoga & mobility", "Spin & Zumba", "New weekly schedule, posted every Monday"],
  },
  {
    icon: HeartPulse, title: "Personal training",
    items: ["Certified 1-on-1 coaches", "Goal-based programming", "Form correction & injury-safe progressions"],
  },
  {
    icon: Utensils, title: "Diet & nutrition",
    items: ["Custom diet plans from your trainer", "Macro & calorie targets", "Progress check-ins every 2 weeks"],
  },
  {
    icon: QrCode, title: "Members app",
    items: ["QR check-in at the front desk", "Workout plans & attendance history", "Progress photos & body-composition tracking"],
  },
  {
    icon: MessagesSquare, title: "Trainer chat",
    items: ["Message your trainer directly", "Get plan updates & feedback in-app"],
  },
  {
    icon: Boxes, title: "Pro shop",
    items: ["Supplements, shakers & gym accessories", "Member pricing on select brands"],
  },
  {
    icon: ShowerHead, title: "Amenities",
    items: ["Locker rooms & showers", "Filtered water stations", "Air-conditioned floor"],
  },
  {
    icon: ParkingCircle, title: "Convenience",
    items: ["On-site parking", "Open 5 AM – 11 PM, every day"],
  },
  {
    icon: ShieldCheck, title: "Safety",
    items: ["First-aid trained staff on every shift", "Equipment checked & serviced regularly"],
  },
  {
    icon: Trophy, title: "Community",
    items: ["Monthly transformation challenges", "Member events & referral rewards"],
  },
  {
    icon: Smartphone, title: "Billing, simplified",
    items: ["Cash, UPI, or card", "Renewal reminders before your plan lapses"],
  },
];

export const metadata = { title: "Facilities & Classes — ATP Fitness" };

export default function FeaturesPage() {
  return (
    <div className="container px-6 py-20">
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Everything you need to train, in one place</h1>
        <p className="mt-4 text-muted-foreground">
          A full strength floor, group classes, personal coaching, and a members app to track it all.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Card key={m.title}>
            <CardContent className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <m.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{m.title}</h3>
              <ul className="mt-3 space-y-1.5">
                {m.items.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground">• {item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
