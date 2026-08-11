import { ContactForm } from "@/components/features/marketing/contact-form";
import { Mail, MapPin, Phone } from "lucide-react";

export const metadata = { title: "Contact — ATP Fitness" };

export default function ContactPage() {
  return (
    <div className="container px-6 py-20">
      <div className="grid gap-16 lg:grid-cols-2">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Book a free trial</h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Questions about membership plans, classes, or personal training —
            send us a message and someone from the ATP Fitness team will call you back.
          </p>
          <div className="mt-10 space-y-5">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-primary" /> hello@atpfitness.in
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-primary" /> 8897505416
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-primary" /> TCR Towers, 15/704, Main Rd, near Mayur Lodge, Kamalanagar, Anantapur, Andhra Pradesh 515001
            </div>
          </div>
        </div>
        <div className="rounded-2xl border p-6 sm:p-8">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}