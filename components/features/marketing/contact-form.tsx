"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitContactForm, type ContactInput } from "@/lib/actions/contact.actions";
import { CheckCircle2 } from "lucide-react";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, formState } = useForm<ContactInput>();

  function onSubmit(values: ContactInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await submitContactForm(values);
      if (!result.success) return setServerError(result.error);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-secondary/40 p-10 text-center">
        <CheckCircle2 className="h-8 w-8 text-success" />
        <h3 className="font-semibold">Message sent</h3>
        <p className="text-sm text-muted-foreground">We'll get back to you within one business day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Your name" {...register("name", { required: true, minLength: 2 })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" placeholder="+919876543210" {...register("phone", { required: true, minLength: 7 })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@email.com" {...register("email", { required: true })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          rows={5}
          className="flex w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Tell us about your fitness goals, or ask about classes and plans…"
          {...register("message", { required: true, minLength: 10 })}
        />
      </div>
      {formState.errors && Object.keys(formState.errors).length > 0 && (
        <p className="text-sm text-destructive">Please fill in all fields, including a phone number, so we can call you back — message should be at least 10 characters.</p>
      )}
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" loading={isPending}>
        Send message
      </Button>
    </form>
  );
}