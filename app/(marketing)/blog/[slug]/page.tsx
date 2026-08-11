import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const POSTS: Record<string, { title: string; category: string; date: string; body: string[] }> = {
  "first-month-in-gym": {
    title: "New to the gym? Here's what to actually focus on in month one",
    category: "Getting Started",
    date: "Jul 2, 2026",
    body: [
      "The biggest mistake new members make isn't lifting too little — it's trying to do too much, too fast, and burning out by week three.",
      "Your first month at ATP Fitness is really about two things: learning correct form on the core lifts, and showing up consistently. Weight on the bar can wait.",
      "Book a free session with one of our trainers in your first week — they'll set a baseline plan and check your form before you start adding load.",
    ],
  },
  "protein-and-recovery": {
    title: "How much protein do you actually need? A practical guide",
    category: "Nutrition",
    date: "Jun 18, 2026",
    body: [
      "Most people training regularly do fine around 1.6–2.2g of protein per kg of bodyweight per day — you don't need to hit the extreme numbers you see on supplement packaging.",
      "Whole food sources (eggs, dal, paneer, chicken, fish) get you most of the way there. A protein shake fills gaps, it doesn't replace meals.",
      "Ask your trainer for a diet plan tailored to your goals — cutting, maintaining, or bulking all call for different targets.",
    ],
  },
  "group-class-vs-solo": {
    title: "Group classes vs. solo training: how to pick what fits you",
    category: "Training",
    date: "Jun 4, 2026",
    body: [
      "Group classes work well if you need external motivation and enjoy training alongside other people — the pace is set for you, which removes a lot of decision fatigue.",
      "Solo training on the strength floor suits people who want to progress a specific lift or follow a structured program at their own pace.",
      "A lot of our members do both: two or three group classes a week for cardio and community, plus solo strength sessions.",
    ],
  },
  "progress-photos-not-scale": {
    title: "Why your trainer asks for progress photos, not just your weight",
    category: "Progress",
    date: "May 22, 2026",
    body: [
      "Body weight can swing a couple of kilos day to day from water and food alone — it's a noisy number, especially in the first few months.",
      "Photos and simple measurements (waist, arms) show changes in body composition that the scale alone won't, especially if you're gaining muscle while losing fat.",
      "We check in on progress every two weeks, not every day — that's usually enough time for a real trend to show up.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(POSTS).map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = POSTS[slug];
  if (!post) notFound();

  return (
    <article className="container max-w-2xl px-6 py-20">
      <Link href="/blog" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to blog
      </Link>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">{post.category}</span>
        <span>{post.date}</span>
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{post.title}</h1>
      <div className="prose prose-neutral dark:prose-invert mt-8 space-y-4">
        {post.body.map((p, i) => (
          <p key={i} className="text-muted-foreground leading-relaxed">{p}</p>
        ))}
      </div>
    </article>
  );
}
