"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { PhotoUpload } from "./photo-upload";
import { createMember } from "@/lib/actions/member.actions";
import { convertLeadToMember } from "@/lib/actions/crm.actions";
import { memberFormSchema, type MemberFormInput } from "@/lib/validations/member";
import { format } from "date-fns";

interface PlanOption { id: string; name: string; duration_days: number; price: number }
interface TrainerOption { id: string; full_name: string }

export function MemberForm({
  basePath,
  plans,
  trainers,
  leadId,
  defaultValues,
}: {
  basePath: string;
  plans: PlanOption[];
  trainers: TrainerOption[];
  leadId?: string;
  defaultValues?: Partial<Pick<MemberFormInput, "fullName" | "email" | "phone">>;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<MemberFormInput>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      joiningDate: format(new Date(), "yyyy-MM-dd"),
      startDate: format(new Date(), "yyyy-MM-dd"),
      bloodGroup: "unknown",
      paymentStatus: "pending",
      discountAmount: 0,
      amountPaid: 0,
      photoUrl: null,
      ...defaultValues,
    },
  });

  const selectedPlanId = form.watch("planId");
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  function onSubmit(values: MemberFormInput) {
    setServerError(null);
    startTransition(async () => {
      const result = leadId ? await convertLeadToMember(leadId, values) : await createMember(values);
      if (!result.success) {
        setServerError(result.error);
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            form.setError(field as keyof MemberFormInput, { message });
          }
        }
        return;
      }
      router.push(basePath);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Photo & basic details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Controller
            control={form.control}
            name="photoUrl"
            render={({ field }) => (
              <PhotoUpload
                folder="members/photos"
                publicIdPrefix={form.watch("fullName") || "member"}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={form.formState.errors.fullName?.message}>
              <Input {...form.register("fullName")} placeholder="Priya Sharma" />
            </Field>
            <Field label="Phone" error={form.formState.errors.phone?.message}>
              <Input {...form.register("phone")} placeholder="+919876543210" />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} placeholder="priya@example.com" />
            </Field>
            <Field label="Date of birth">
              <Input type="date" {...form.register("dateOfBirth")} />
            </Field>
            <Field label="Gender">
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...form.register("gender")}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </Select>
            </Field>
            <Field label="Joining date" error={form.formState.errors.joiningDate?.message}>
              <Input type="date" {...form.register("joiningDate")} />
            </Field>
          </div>
          <Field label="Address">
            <Input {...form.register("address")} placeholder="Street, City, State" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Emergency contact & medical</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Emergency contact name">
              <Input {...form.register("emergencyContactName")} placeholder="Contact name" />
            </Field>
            <Field label="Emergency contact phone">
              <Input {...form.register("emergencyContactPhone")} placeholder="+919876543210" />
            </Field>
            <Field label="Blood group">
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...form.register("bloodGroup")}>
                {["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                  <option key={bg} value={bg}>{bg === "unknown" ? "Unknown" : bg}</option>
                ))}
              </Select>
            </Field>
            <Field label="Height (cm)">
              <Input type="number" step="0.1" {...form.register("heightCm")} />
            </Field>
            <Field label="Weight (kg)">
              <Input type="number" step="0.1" {...form.register("weightKg")} />
            </Field>
          </div>
          <Field label="Medical conditions">
            <Input {...form.register("medicalConditions")} placeholder="Any conditions the trainer should know about" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Membership & payment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan" error={form.formState.errors.planId?.message}>
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...form.register("planId")}>
                <option value="">Select a plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.duration_days} days — ₹{p.price}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assign trainer">
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...form.register("trainerId")}>
                <option value="">Unassigned</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Start date" error={form.formState.errors.startDate?.message}>
              <Input type="date" {...form.register("startDate")} />
            </Field>
            <Field label="Amount (₹)">
              <Input
                type="number"
                step="0.01"
                {...form.register("amount")}
                defaultValue={selectedPlan?.price}
              />
            </Field>
            <Field label="Discount (₹)">
              <Input type="number" step="0.01" {...form.register("discountAmount")} />
            </Field>
            <Field label="Amount paid (₹)">
              <Input type="number" step="0.01" {...form.register("amountPaid")} />
            </Field>
            <Field label="Payment status">
              <Select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" {...form.register("paymentStatus")}>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={isPending}>{leadId ? "Convert to member" : "Create member"}</Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
