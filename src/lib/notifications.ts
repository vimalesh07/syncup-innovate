import { supabase } from "@/integrations/supabase/client";

type NotificationPayload = {
  user_id: string;
  type?: string | null;
  title: string;
  message?: string | null;
  target_path?: string | null;
  metadata?: Record<string, unknown>;
};

export type DirectMessageNotificationMetadata = {
  type: "direct_message";
  senderId: string;
  receiverId?: string;
  senderName: string;
  senderAvatar: string | null;
  conversationId: string;
  messageId?: string;
  messagePreview: string;
};

export async function insertNotification(payload: NotificationPayload) {
  const result = await (supabase as any).from("notifications").insert(payload);
  if (!result.error || !isMissingNotificationColumn(result.error) || (!payload.metadata && !payload.type && !payload.target_path)) return result;

  if (isMissingNotificationTargetColumn(result.error)) {
    const { type: _type, target_path: _targetPath, ...metadataPayload } = payload;
    const metadataResult = await (supabase as any).from("notifications").insert(metadataPayload);
    if (!metadataResult.error || !isMissingNotificationColumn(metadataResult.error)) return metadataResult;
  }

  const { metadata: _metadata, type: _type, target_path: _targetPath, ...basicPayload } = payload;
  return (supabase as any).from("notifications").insert(basicPayload);
}

export function directMessageNotification(payload: DirectMessageNotificationMetadata & { userId: string }) {
  const preview = truncateMessagePreview(payload.messagePreview);
  const receiverConversationId = `direct-${payload.senderId}`;
  const targetPath = `/messages/${encodeURIComponent(receiverConversationId)}`;
  return {
    user_id: payload.userId,
    type: "direct_message",
    title: `${payload.senderName} sent you a message`,
    message: preview,
    target_path: targetPath,
    metadata: {
      type: "direct_message",
      senderId: payload.senderId,
      receiverId: payload.receiverId ?? payload.userId,
      senderName: payload.senderName,
      senderAvatar: payload.senderAvatar,
      conversationId: receiverConversationId,
      senderConversationId: payload.conversationId,
      messageId: payload.messageId,
      messagePreview: preview,
      targetPath,
      target_path: targetPath,
    },
  };
}

function truncateMessagePreview(message: string) {
  const trimmed = message.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}...`;
}

function isMissingNotificationColumn(error: { message?: string }) {
  const message = error.message ?? "";
  return message.includes("metadata") || message.includes("target_path") || message.includes("type") || message.includes("schema cache") || message.includes("Could not find");
}

function isMissingNotificationTargetColumn(error: { message?: string }) {
  const message = error.message ?? "";
  return message.includes("target_path") || message.includes("type") || message.includes("schema cache") || message.includes("Could not find");
}
