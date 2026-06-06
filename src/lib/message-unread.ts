export const MESSAGE_UNREAD_CHANGED_EVENT = "syncup_message_reads_updated";

export type UnreadConversationLike = {
  unreadCount?: number | null;
  isUnread?: boolean | null;
};

export type UnreadMessageLike = {
  id: string;
  sender_id: string;
  read?: boolean | null;
  read_by?: string[] | null;
  deleted_for_everyone?: boolean | null;
  deleted_at?: string | null;
};

export function getUnreadMessagesCount(conversations: UnreadConversationLike[]) {
  return conversations.reduce((total, conversation) => {
    const count = Number(conversation.unreadCount ?? 0);
    if (Number.isFinite(count) && count > 0) return total + count;
    return total + (conversation.isUnread ? 1 : 0);
  }, 0);
}

export function countUnreadMessages(rows: UnreadMessageLike[], userId: string, localReads = new Set<string>()) {
  return rows.filter((message) => isUnreadMessage(message, userId, localReads)).length;
}

export function isUnreadMessage(message: UnreadMessageLike, userId: string, localReads = new Set<string>()) {
  if (message.deleted_for_everyone || message.deleted_at) return false;
  if (message.sender_id === userId) return false;
  if (localReads.has(message.id)) return false;
  if ((message.read_by ?? []).includes(userId)) return false;
  return !message.read;
}

export function notifyUnreadMessagesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MESSAGE_UNREAD_CHANGED_EVENT));
  }
}
