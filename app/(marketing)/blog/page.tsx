import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";

const POSTS = [
  {
    slug: "first-month-in-gym",
    title: "New to the gym? Here's what to actually focus on in month one",
    excerpt: "Form and consistency beat heavy weights early on. A simple plan for your first four weeks at ATP Fitness.",
    category: "Getting Started",
    date: "Jul 2, 2026",
  },
  {
    slug: "protein-and-recovery",
    title: "How much protein do you actually need? A practical guide",
    excerpt: "Cutting through the supplement-aisle noise with realistic targets based on your training load.",
    category: "Nutrition",
    date: "Jun 18, 2026",
  },
  {
    slug: "group-class-vs-solo",
    title: "Group classes vs. solo training: how to pick what fits you",
    excerpt: "Some people thrive on class energy, others need quiet focus. Here's how to figure out which is you.",
    category: "Training",
    date: "Jun 4, 2026",
  },
  {
    slug: "progress-photos-not-scale",
    title: "Why your trainer asks for progress photos, not just your weight",
    excerpt: "The scale doesn't tell the whole story. What we actually track to know a plan is working.",
    category: "Progress",
    date: "May 22, 2026",
  },
];

export const metadata = { title: "Blog — ATP Fitness" };

export default function BlogPage() {
  return (
    <div className="container px-6 py-20">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Training notes</h1>
        <p className="mt-4 text-muted-foreground">Tips on training, nutrition, and recovery from the ATP Fitness coaching team.</p>
      </div>
      <div className="mx-auto grid max-w-4xl gap-6">
        {POSTS.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`}>
            <Card className="transition-shadow hover:shadow-lg">
              <CardContent className="flex items-start justify-between gap-4 p-6">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">{post.category}</span>
                    <span>{post.date}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold">{post.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{post.excerpt}</p>
                </div>
                <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
