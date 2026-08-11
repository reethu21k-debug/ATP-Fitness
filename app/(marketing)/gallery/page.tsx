import { Camera } from "lucide-react";

const CATEGORIES = [
  { label: "Strength floor", gradient: "from-indigo-500 to-violet-600" },
  { label: "Group classes", gradient: "from-fuchsia-500 to-pink-600" },
  { label: "Cardio zone", gradient: "from-sky-500 to-cyan-600" },
  { label: "Transformation stories", gradient: "from-amber-500 to-orange-600" },
  { label: "Trainer sessions", gradient: "from-emerald-500 to-teal-600" },
  { label: "Community events", gradient: "from-rose-500 to-red-600" },
  { label: "Recovery & stretch", gradient: "from-purple-500 to-indigo-600" },
  { label: "Locker & amenities", gradient: "from-slate-500 to-slate-700" },
];

export const metadata = { title: "Gallery — ATP Fitness" };

export default function GalleryPage() {
  return (
    <div className="container px-6 py-20">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Take a look around</h1>
        <p className="mt-4 text-muted-foreground">
          Placeholder gallery — swap these tiles with real photos of the ATP
          Fitness floor, classes, and trainers via the gym's admin panel.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {CATEGORIES.map((c) => (
          <div
            key={c.label}
            className={`group relative flex aspect-square items-end overflow-hidden rounded-2xl bg-gradient-to-br ${c.gradient} p-4`}
          >
            <Camera className="absolute right-4 top-4 h-5 w-5 text-white/50" />
            <span className="text-sm font-medium text-white">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
