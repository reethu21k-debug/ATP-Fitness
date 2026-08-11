"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requirePermission, requireRole, PermissionError } from "@/lib/utils/permissions";
import type { ActionResult } from "./auth.actions";
import type { ChatChannelOverviewRow, ChatMessage, ChatParticipant } from "@/types/database";
import { sendMessageSchema, createBroadcastSchema, type SendMessageInput, type CreateBroadcastInput } from "@/lib/validations/chat";

// ============================================================================
// LIST MY CHANNELS (chat home / sidebar list)
// ============================================================================
export async function listMyChannels(): Promise<ActionResult<ChatChannelOverviewRow[]>> {
  try {
    await requirePermission("chat", "read");
  } catch {
    return { success: false, error: "You do not have permission to use chat." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_channels_overview")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) return { success: false, error: "Could not load conversations." };
  return { success: true, data: (data ?? []) as ChatChannelOverviewRow[] };
}

// ============================================================================
// WHO CAN I MESSAGE — role-appropriate contact list to start a new direct chat
// ============================================================================
export async function listChatableContacts(): Promise<ActionResult<ChatParticipant[]>> {
  const actor = await getCurrentProfile();
  if (!actor) return { success: false, error: "Not authenticated." };

  const supabase = await createClient();

  if (actor.role === "member") {
    const { data: details } = await supabase
      .from("member_details")
      .select("assigned_trainer_id")
      .eq("profile_id", actor.id)
      .single();
    if (!details?.assigned_trainer_id) return { success: true, data: [] };
    const { data: trainer } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .eq("id", details.assigned_trainer_id)
      .single();
    return { success: true, data: trainer ? [trainer as ChatParticipant] : [] };
  }

  if (actor.role === "trainer") {
    const { data: clients } = await supabase
      .from("member_details")
      .select("profile_id, profiles!member_details_profile_id_fkey(id, full_name, avatar_url, role)")
      .eq("assigned_trainer_id", actor.id);

    const { data: owner } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .eq("tenant_id", actor.tenant_id ?? "")
      .eq("role", "gym_owner")
      .maybeSingle();

    const clientContacts: ChatParticipant[] = (clients ?? [])
      .map((c: { profiles: unknown }) => c.profiles as ChatParticipant)
      .filter(Boolean);

    return { success: true, data: owner ? [...clientContacts, owner as ChatParticipant] : clientContacts };
  }

  if (actor.role === "gym_owner") {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .eq("gym_id", actor.gym_id ?? "")
      .in("role", ["trainer", "receptionist"])
      .order("full_name");
    return { success: true, data: (staff ?? []) as ChatParticipant[] };
  }

  return { success: true, data: [] };
}

// ============================================================================
// START (OR RESUME) A DIRECT CHAT
// The DB function enforces the real pairing rules (trainer<->member,
// owner<->staff) — the client-facing action just surfaces its errors.
// ============================================================================
export async function startDirectChat(otherProfileId: string): Promise<ActionResult<{ channelId: string }>> {
  try {
    await requirePermission("chat", "create");
  } catch {
    return { success: false, error: "You do not have permission to start a chat." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_or_create_direct_channel", { p_other_profile_id: otherProfileId });
    if (error) {
      console.error("startDirectChat: get_or_create_direct_channel failed:", error.message);
      return { success: false, error: error.message || "Could not start the conversation." };
    }
    if (!data) {
      console.error("startDirectChat: RPC returned no channel id");
      return { success: false, error: "Could not start the conversation." };
    }
    return { success: true, data: { channelId: data as string } };
  } catch (e) {
    console.error("startDirectChat: unexpected error:", e);
    return { success: false, error: "Something went wrong starting the conversation." };
  }
}

// ============================================================================
// BROADCAST (gym_owner only — announcement to a whole audience at once)
// ============================================================================
export async function createBroadcast(input: CreateBroadcastInput): Promise<ActionResult<{ channelId: string }>> {
  const parsed = createBroadcastSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form for errors." };
  }

  try {
    await requireRole("gym_owner");
  } catch (e) {
    return { success: false, error: e instanceof PermissionError ? e.message : "Not authenticated." };
  }

  const data = parsed.data;
  const supabase = await createClient();
  const { data: channelId, error } = await supabase.rpc("create_broadcast_channel", {
    p_name: data.name,
    p_audience: data.audience,
  });
  if (error || !channelId) return { success: false, error: "Could not create the broadcast." };

  const actor = await getCurrentProfile();
  const { error: msgError } = await supabase
    .from("chat_messages")
    .insert({ channel_id: channelId, sender_id: actor!.id, body: data.firstMessage });
  if (msgError) return { success: false, error: "Broadcast created, but the first message failed to send." };

  revalidatePath("/dashboard/owner/chat");
  return { success: true, data: { channelId: channelId as string } };
}

// ============================================================================
// MESSAGES: list (paginated, newest last) + send
// ============================================================================
export async function listChannelMessages(
  channelId: string,
  before?: string
): Promise<ActionResult<ChatMessage[]>> {
  try {
    await requirePermission("chat", "read");
  } catch {
    return { success: false, error: "You do not have permission to use chat." };
  }

  const supabase = await createClient();
  let query = supabase
    .from("chat_messages")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) return { success: false, error: "Could not load messages." };
  return { success: true, data: ((data ?? []) as ChatMessage[]).reverse() };
}

export async function sendChatMessage(input: SendMessageInput): Promise<ActionResult<{ messageId: string }>> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Message can't be empty." };
  }

  try {
    await requirePermission("chat", "create");
  } catch {
    return { success: false, error: "You do not have permission to send messages." };
  }

  const actor = await getCurrentProfile();
  if (!actor) return { success: false, error: "Not authenticated." };

  const data = parsed.data;
  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("chat_messages")
    .insert({
      channel_id: data.channelId,
      sender_id: actor.id,
      body: data.body?.trim() || null,
      attachment_url: data.attachmentUrl || null,
      attachment_type: data.attachmentType || null,
      attachment_public_id: data.attachmentPublicId || null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: "Message could not be sent. You may not be a member of this chat." };
  return { success: true, data: { messageId: inserted.id } };
}

// ============================================================================
// MARK READ
// ============================================================================
export async function markChannelRead(channelId: string): Promise<ActionResult> {
  const actor = await getCurrentProfile();
  if (!actor) return { success: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("chat_channel_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("channel_id", channelId)
    .eq("profile_id", actor.id);

  if (error) return { success: false, error: "Could not update read status." };
  return { success: true };
}