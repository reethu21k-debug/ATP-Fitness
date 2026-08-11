"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendChatMessage } from "@/lib/actions/ai.actions";
import type { AiChatMessage } from "@/types/database";
import { Sparkles, Send, Loader2 } from "lucide-react";

const SUGGESTIONS = ["How much protein do I need daily?", "Suggest a warm-up routine", "How do I break a weight-loss plateau?"];

export function AiChatAssistant({ initialHistory }: { initialHistory: AiChatMessage[] }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>(
    initialHistory.map((m) => ({ role: m.role, content: m.content }))
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send(text: string) {
    if (!text.trim()) return;
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    startTransition(async () => {
      const result = await sendChatMessage(text);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const reply = result.data?.reply;
      if (!reply) {
        setError("No response from the assistant.");
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    });
  }

  return (
    <Card className="flex h-[70vh] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 text-primary" />
            <p className="text-sm">Ask me about workouts, nutrition, or fitness goals.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-xs hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {isPending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      {error && <p className="px-6 pb-2 text-sm text-destructive">{error}</p>}

      <CardContent className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask something…" disabled={isPending} />
          <Button type="submit" size="icon" disabled={isPending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
