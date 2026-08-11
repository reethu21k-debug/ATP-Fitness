export const metadata = { title: "Terms of Service — ATP Fitness" };

const SECTIONS = [
  { title: "1. Using ATP Fitness", body: "You may use ATP Fitness to manage members, staff, and operations for gyms you own or are authorized to administer. Each gym owner account is responsible for the accuracy of data entered by their staff." },
  { title: "2. Accounts & access", body: "Access to ATP Fitness is role-based. Gym owners control which staff accounts exist and what each role can see or change within their tenant. You're responsible for keeping login credentials confidential." },
  { title: "3. Member data", body: "Member data you enter (contact details, medical notes, payment records) belongs to your gym. ATP Fitness processes it on your behalf to provide the service and does not sell member data to third parties." },
  { title: "4. Billing", body: "Subscriptions renew automatically at the interval you select. You can cancel anytime from Settings; access continues until the end of the current billing period." },
  { title: "5. Termination", body: "We may suspend accounts that violate these terms or are used for unlawful purposes. You may export your data before closing an account." },
  { title: "6. Changes", body: "We'll notify account owners by email of material changes to these terms before they take effect." },
];

export default function TermsPage() {
  return (
    <div className="container max-w-2xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: July 2026</p>
      <div className="mt-10 space-y-8">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
