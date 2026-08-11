import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/utils/permissions";
import { ChatShell } from "@/components/features/chat/chat-shell";

export const metadata = { title: "Chat — ATP Fitness" };

export default async function MemberChatPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Chat</h1>
        <p className="text-sm text-muted-foreground">Message your trainer, and see announcements from your gym.</p>
      </div>
      <ChatShell currentUserId={profile.id} canBroadcast={false} />
    </div>
  );
}
