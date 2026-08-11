import { z } from "zod";

export const sendMessageSchema = z
  .object({
    channelId: z.string().uuid(),
    body: z.string().max(4000).optional(),
    attachmentUrl: z.string().url().optional(),
    attachmentType: z.enum(["image", "voice", "pdf"]).optional(),
    attachmentPublicId: z.string().optional(),
  })
  .refine((v) => !!v.body?.trim() || !!v.attachmentUrl, {
    message: "Message can't be empty.",
    path: ["body"],
  });
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const createBroadcastSchema = z.object({
  name: z.string().min(2, "Give the broadcast a name."),
  audience: z.enum(["all_members", "all_staff", "all_trainers", "all_receptionists"]),
  firstMessage: z.string().min(1, "Write the announcement."),
});
export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;
