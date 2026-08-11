"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { listChannelMessages, sendChatMessage, markChannelRead } from "@/lib/actions/chat.actions";
import type { ChatMessage } from "@/types/database";
import type { SendMessageInput } from "@/lib/validations/chat";

/**
 * Loads a channel's message history, then subscribes to Supabase Realtime for
 * new inserts on `chat_messages` filtered to this channel — so every
 * participant sees new messages the instant they're sent, no polling.
 */
export function useRealtimeMessages(channelId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const res = await listChannelMessages(id);
    if (res.success && res.data) {
      setMessages(res.data);
      seenIds.current = new Set(res.data.map((m) => m.id));
    }
    setLoading(false);
    markChannelRead(id);
  }, []);

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      return;
    }
    load(channelId);

    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          if (seenIds.current.has(incoming.id)) return;
          seenIds.current.add(incoming.id);
          setMessages((prev) => [...prev, incoming]);
          markChannelRead(channelId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, load]);

  async function send(input: Omit<SendMessageInput, "channelId">) {
    if (!channelId) return { success: false as const, error: "No conversation selected." };
    return sendChatMessage({ ...input, channelId });
  }

  return { messages, loading, send };
}
