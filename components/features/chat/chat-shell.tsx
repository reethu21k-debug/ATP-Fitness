"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Send, Megaphone, MessageCircle, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewChatDialog } from "./new-chat-dialog";
import { ChatAttachmentUpload, AttachmentPreview, type ChatAttachment } from "./chat-attachment-upload";
import { useRealtimeMessages } from "@/hooks/use-realtime-messages";
import { listMyChannels } from "@/lib/actions/chat.actions";
import type { ChatChannelOverviewRow } from "@/types/database";
import { cn } from "@/lib/utils/cn";

export function ChatShell({ currentUserId, canBroadcast }: { currentUserId: string; canBroadcast: boolean }) {
  const [channels, setChannels] = useState<ChatChannelOverviewRow[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);

  const { messages, loading: loadingMessages, send } = useRealtimeMessages(activeChannelId);

  async function refreshChannels(selectId?: string) {
    setLoadingChannels(true);
    const res = await listMyChannels();
    if (res.success && res.data) {
      setChannels(res.data);
      if (selectId) setActiveChannelId(selectId);
      else if (!activeChannelId && res.data.length > 0) setActiveChannelId(res.data[0]?.channel_id ?? null);
    }
    setLoadingChannels(false);
  }

  useEffect(() => {
    refreshChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeChannel = channels.find((c) => c.channel_id === activeChannelId);

  function channelLabel(c: ChatChannelOverviewRow) {
    if (c.type === "broadcast") return c.name ?? "Broadcast";
    const others = c.other_participants ?? [];
    return others.map((p) => p.full_name).join(", ") || "Conversation";
  }

  async function handleSend() {
    if (!draft.trim() && !pendingAttachment) return;
    const body = draft;
    const attachment = pendingAttachment;
    setDraft("");
    setPendingAttachment(null);
    const result = await send({
      body: body.trim() || undefined,
      attachmentUrl: attachment?.url,
      attachmentType: attachment?.type,
      attachmentPublicId: attachment?.publicId,
    });
    if (!result.success) {
      setDraft(body);
      setPendingAttachment(attachment);
    } else {
      refreshChannels(activeChannelId ?? undefined);
    }
  }

  return (
    <Card className="flex h-[calc(100vh-13rem)] overflow-hidden">
      {/* Channel list -- full width on mobile until a channel is picked, then
          replaced by the thread; always a fixed-width sidebar from md up. */}
      <div className={cn("w-full shrink-0 flex-col border-r md:flex md:w-72", activeChannelId ? "hidden md:flex" : "flex")}>
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="text-sm font-semibold">Messages</h2>
          <NewChatDialog canBroadcast={canBroadcast} onStarted={(id) => refreshChannels(id)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingChannels ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : channels.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No conversations yet. Tap "New" to start one.</p>
          ) : (
            channels.map((c) => (
              <button
                key={c.channel_id}
                onClick={() => setActiveChannelId(c.channel_id)}
                className={cn(
                  "flex w-full items-start gap-2.5 border-b px-3 py-3 text-left transition-colors hover:bg-accent",
                  c.channel_id === activeChannelId && "bg-accent"
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {c.type === "broadcast" ? <Megaphone className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{channelLabel(c)}</p>
                    {c.unread_count > 0 && (
                      <span className="flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.last_message_preview ?? "No messages yet"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread -- hidden on mobile until a channel is picked, so the two
          panes never have to squeeze onto one narrow screen at once. */}
      <div className={cn("min-w-0 flex-1 flex-col md:flex", activeChannelId ? "flex" : "hidden md:flex")}>
        {!activeChannel ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation to get started.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b p-3">
              <button
                onClick={() => setActiveChannelId(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{channelLabel(activeChannel)}</p>
                {activeChannel.type === "broadcast" && (
                  <p className="text-xs text-muted-foreground">
                    Broadcast · {activeChannel.broadcast_audience?.replace("_", " ")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {loadingMessages ? (
                <p className="text-center text-sm text-muted-foreground">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">No messages yet — say hello 👋</p>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_id === currentUserId;
                  return (
                    <div key={m.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] space-y-1.5 rounded-2xl px-3.5 py-2 text-sm",
                          isMine ? "bg-primary text-primary-foreground" : "bg-secondary"
                        )}
                      >
                        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                        {m.attachment_url && m.attachment_type && (
                          <AttachmentPreview type={m.attachment_type} url={m.attachment_url} />
                        )}
                        <p className={cn("text-[10px]", isMine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {activeChannel.can_send ? (
              <div className="border-t p-3">
                {pendingAttachment && (
                  <div className="mb-2 flex items-center gap-2">
                    <AttachmentPreview type={pendingAttachment.type} url={pendingAttachment.url} />
                    <button
                      onClick={() => setPendingAttachment(null)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <ChatAttachmentUpload onUploaded={setPendingAttachment} />
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type a message…"
                    className="h-10 flex-1 rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button size="icon" onClick={handleSend}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t p-3 text-center text-xs text-muted-foreground">
                This is a broadcast announcement — only the sender can post here.
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
