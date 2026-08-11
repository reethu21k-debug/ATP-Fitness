import { getChatHistory } from "@/lib/actions/ai.actions";
import { AiChatAssistant } from "@/components/features/ai/ai-chat-assistant";

export const metadata = { title: "AI Assistant — ATP Fitness" };

export default async function MemberAiAssistantPage() {
  const history = await getChatHistory();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fitness and nutrition questions, answered instantly.</p>
      </div>
      <AiChatAssistant initialHistory={history} />
    </div>
  );
}
