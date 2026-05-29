import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  BellOff,
  Check,
  CheckCheck,
  Copy,
  Download,
  Edit3,
  FileText,
  Loader2,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Pin,
  Reply,
  Search,
  Send,
  SmilePlus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { supabase } from "@/integrations/supabase/client";
import { Profile, initials } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages | SyncUp" }] }),
  component: MessagesRoute,
});

const reactions = ["👍", "❤️", "🔥", "😂", "😮", "😢"];

type MessageKind = "direct" | "request";

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id?: string;
  request_id?: string;
  message: string;
  created_at: string;
  read?: boolean | null;
  deleted_for?: string[] | null;
  deleted_for_everyone?: boolean | null;
  delivered_at?: string | null;
  read_by?: string[] | null;
  edited_at?: string | null;
  reply_to_id?: string | null;
  pinned_by?: string[] | null;
  reactions?: Record<string, string[]> | null;
  attachment_urls?: string[] | null;
  attachment_names?: string[] | null;
  attachment_types?: string[] | null;
};

type JoinRequest = {
  id: string;
  user_id: string;
  team_id: string;
  status: string;
  message: string | null;
  created_at: string;
};

type Team = {
  id: string;
  team_name: string;
  leader_id: string;
};

type Presence = {
  user_id: string;
  status: "online" | "away" | "offline";
  last_seen_at: string;
};

type TypingRow = {
  thread_id: string;
  user_id: string;
  expires_at: string;
};

type Thread = {
  id: string;
  type: MessageKind;
  title: string;
  subtitle: string;
  avatarUrl?: string | null;
  profileId?: string;
  teamId?: string;
  requestId?: string;
  recipientId?: string;
  updatedAt: string;
  messages: MessageRow[];
  unreadCount: number;
};

type AttachmentDraft = {
  file: File;
  previewUrl?: string;
};

function MessagesRoute() {
  return (
    <ProtectedPage>
      <PlatformShell>
        <MessagesPage />
      </PlatformShell>
    </ProtectedPage>
  );
}

function MessagesPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [presence, setPresence] = useState<Map<string, Presence>>(new Map());
  const [typingRows, setTypingRows] = useState<TypingRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [compactChat, setCompactChat] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [quickProfile, setQuickProfile] = useState<Profile | null>(null);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [dragging, setDragging] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  const selected = useMemo(() => threads.find((thread) => thread.id === selectedId) ?? threads[0] ?? null, [threads, selectedId]);
  const muteKey = user ? `syncup_muted_threads_${user.id}` : "";
  const draftPrefix = user ? `syncup_message_draft_${user.id}_` : "";
  const muted = useMemo(() => readStringSet(muteKey), [muteKey, threads.length]);

  const visibleThreads = useMemo(() => {
    const now = Date.now();
    return threads
      .filter((thread) => {
        if (!query.trim()) return true;
        const needle = query.toLowerCase();
        return [
          thread.title,
          thread.subtitle,
          new Date(thread.updatedAt).toLocaleDateString(),
          ...thread.messages.map((message) => `${message.message} ${new Date(message.created_at).toLocaleDateString()}`),
        ].some((value) => value.toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        const aTyping = typingRows.some((row) => row.thread_id === a.id && row.user_id !== user?.id && +new Date(row.expires_at) > now);
        const bTyping = typingRows.some((row) => row.thread_id === b.id && row.user_id !== user?.id && +new Date(row.expires_at) > now);
        if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
        if (Number(aTyping) !== Number(bTyping)) return Number(bTyping) - Number(aTyping);
        return +new Date(b.updatedAt) - +new Date(a.updatedAt);
      });
  }, [threads, query, typingRows, user?.id]);

  const pinnedMessages = useMemo(() => selected?.messages.filter((message) => (message.pinned_by ?? []).length) ?? [], [selected]);
  const selectedTyping = useMemo(() => {
    if (!selected || !user) return [];
    const now = Date.now();
    return typingRows
      .filter((row) => row.thread_id === selected.id && row.user_id !== user.id && +new Date(row.expires_at) > now)
      .map((row) => profiles.get(row.user_id)?.full_name || profiles.get(row.user_id)?.username || "Someone");
  }, [selected, typingRows, profiles, user]);

  const loadThreads = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!user) return;
    if (!silent) setLoading(true);

    const directProfileId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("direct") : null;
    const deletedThreads = readLocalDeletedThreads(user.id);
    const directResult = await (supabase as any)
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: true });

    if (directResult.error) {
      toast.error(directResult.error.message);
      if (!silent) setLoading(false);
      return;
    }

    const leaderTeamsResult = await supabase.from("teams").select("id, team_name, leader_id").eq("leader_id", user.id);
    const leaderTeams = (leaderTeamsResult.data as Team[]) ?? [];
    const leaderTeamIds = leaderTeams.map((team) => team.id);
    const ownRequestsResult = await supabase.from("join_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const leaderRequestsResult = leaderTeamIds.length
      ? await supabase.from("join_requests").select("*").in("team_id", leaderTeamIds).order("created_at", { ascending: false })
      : { data: [] };
    const requests = uniqueById([...(ownRequestsResult.data as JoinRequest[] ?? []), ...(leaderRequestsResult.data as JoinRequest[] ?? [])]);
    const requestIds = requests.map((request) => request.id);
    const requestMessagesResult = requestIds.length
      ? await (supabase as any).from("join_request_messages").select("*").in("request_id", requestIds).order("created_at", { ascending: true })
      : { data: [] };

    const allTeamIds = [...new Set([...leaderTeamIds, ...requests.map((request) => request.team_id)])];
    const teamsResult = allTeamIds.length ? await supabase.from("teams").select("id, team_name, leader_id").in("id", allTeamIds) : { data: [] };
    const teamMap = new Map([...(teamsResult.data as Team[] ?? []), ...leaderTeams].map((team) => [team.id, team]));

    const localReactions = readLocalReactionFallback(user.id);
    const localPins = readLocalPinFallback(user.id);
    const localReads = readLocalReadFallback(user.id);
    const directRows = ((directResult.data as MessageRow[]) ?? [])
      .filter(isVisibleFor(user.id))
      .filter((message) => {
        const otherId = message.sender_id === user.id ? message.recipient_id! : message.sender_id;
        return isAfterDeletedThreadCutoff(`direct-${otherId}`, message.created_at, deletedThreads);
      })
      .map((message) => applyLocalReadFallback(applyLocalPinFallback(applyLocalReactionFallback(message, localReactions), localPins), localReads, user.id));
    const otherProfileIds = new Set<string>();
    directRows.forEach((message) => otherProfileIds.add(message.sender_id === user.id ? message.recipient_id! : message.sender_id));
    if (directProfileId && directProfileId !== user.id) otherProfileIds.add(directProfileId);
    requests.forEach((request) => {
      const team = teamMap.get(request.team_id);
      otherProfileIds.add(request.user_id);
      if (team?.leader_id) otherProfileIds.add(team.leader_id);
    });

    const profilesResult = otherProfileIds.size ? await supabase.from("profiles").select("*").in("id", [...otherProfileIds]) : { data: [] };
    const profileMap = new Map(((profilesResult.data as Profile[]) ?? []).map((profile) => [profile.id, profile]));
    setProfiles(profileMap);

    const presenceResult = otherProfileIds.size ? await (supabase as any).from("message_presence").select("*").in("user_id", [...otherProfileIds]) : { data: [] };
    setPresence(new Map(((presenceResult.data as Presence[]) ?? []).map((item) => [item.user_id, item])));

    const directThreads = [...groupBy(directRows, (message) => (message.sender_id === user.id ? message.recipient_id! : message.sender_id)).entries()].map(([otherId, messages]) => {
      const profile = profileMap.get(otherId);
      const last = messages[messages.length - 1];
      return {
        id: `direct-${otherId}`,
        type: "direct" as const,
        title: profile?.full_name || profile?.username || "SyncUp user",
        subtitle: last?.message || attachmentSubtitle(last) || "Direct message",
        avatarUrl: profile?.avatar_url,
        profileId: otherId,
        recipientId: otherId,
        updatedAt: last?.created_at ?? new Date().toISOString(),
        messages,
        unreadCount: messages.filter((message) => isUnread(message, user.id)).length,
      };
    });

    if (directProfileId && directProfileId !== user.id && !directThreads.some((thread) => thread.recipientId === directProfileId)) {
      const profile = profileMap.get(directProfileId);
      directThreads.unshift({
        id: `direct-${directProfileId}`,
        type: "direct",
        title: profile?.full_name || profile?.username || "SyncUp user",
        subtitle: "Start a direct message",
        avatarUrl: profile?.avatar_url,
        profileId: directProfileId,
        recipientId: directProfileId,
        updatedAt: new Date().toISOString(),
        messages: [],
        unreadCount: 0,
      });
    }

    const requestMessageMap = groupBy(
      ((requestMessagesResult.data as MessageRow[]) ?? [])
        .filter(isVisibleFor(user.id))
        .filter((message) => isAfterDeletedThreadCutoff(`request-${message.request_id}`, message.created_at, deletedThreads))
        .map((message) => applyLocalReadFallback(applyLocalPinFallback(applyLocalReactionFallback(message, localReactions), localPins), localReads, user.id)),
      (message) => message.request_id ?? "",
    );
    const requestThreads = requests.map((request) => {
      const team = teamMap.get(request.team_id);
      const otherId = request.user_id === user.id ? team?.leader_id : request.user_id;
      const profile = otherId ? profileMap.get(otherId) : null;
      const rows = requestMessageMap.get(request.id) ?? [];
      const visibleMessages = request.message
        ? [{ id: `${request.id}-initial`, sender_id: request.user_id, request_id: request.id, message: request.message, created_at: request.created_at, read_by: [user.id] }, ...rows]
        : rows;
      const last = visibleMessages[visibleMessages.length - 1];
      return {
        id: `request-${request.id}`,
        type: "request" as const,
        title: team?.team_name || "Team request",
        subtitle: last?.message || `${request.status} request`,
        avatarUrl: profile?.avatar_url,
        profileId: otherId,
        teamId: request.team_id,
        requestId: request.id,
        recipientId: otherId,
        updatedAt: last?.created_at ?? request.created_at,
        messages: visibleMessages,
        unreadCount: visibleMessages.filter((message) => isUnread(message, user.id)).length,
      };
    });

    const nextThreads = [...directThreads, ...requestThreads];
    setThreads(nextThreads);
    setSelectedId((current) => {
      if (directProfileId && directProfileId !== user.id) return `direct-${directProfileId}`;
      return current && nextThreads.some((thread) => thread.id === current) ? current : nextThreads[0]?.id ?? null;
    });
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadThreads();
    if (!user || typeof window === "undefined") return;

    upsertPresence("online");
    const markAway = () => upsertPresence(document.hidden ? "away" : "online");
    const markOffline = () => upsertPresence("offline");
    document.addEventListener("visibilitychange", markAway);
    window.addEventListener("beforeunload", markOffline);

    const channel = supabase
      .channel(`messages-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, (payload) => {
        notifyIncoming(payload);
        loadThreads({ silent: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "join_request_messages" }, (payload) => {
        notifyIncoming(payload);
        loadThreads({ silent: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_presence" }, (payload) => {
        const row = (payload.new ?? payload.old) as Presence;
        if (!row?.user_id) return;
        setPresence((current) => new Map(current).set(row.user_id, row));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_typing" }, () => loadTyping())
      .subscribe();

    const refreshTimer = window.setInterval(() => {
      loadTyping();
      upsertPresence(document.hidden ? "away" : "online");
    }, 12000);

    return () => {
      document.removeEventListener("visibilitychange", markAway);
      window.removeEventListener("beforeunload", markOffline);
      window.clearInterval(refreshTimer);
      supabase.removeChannel(channel);
      upsertPresence("offline");
    };
  }, [user?.id]);

  useEffect(() => {
    if (!selected || !user) return;
    const draft = window.localStorage.getItem(`${draftPrefix}${selected.id}`) ?? "";
    setText(draft);
    setReplyTo(null);
    setEditing(null);
    markThreadRead(selected);
    window.setTimeout(scrollToBottom, 80);
  }, [selected?.id, user?.id]);

  useEffect(() => {
    if (!selected || !user || editing) return;
    window.localStorage.setItem(`${draftPrefix}${selected.id}`, text);
  }, [text, selected?.id, user?.id, editing]);

  const upsertPresence = async (status: Presence["status"]) => {
    if (!user) return;
    await (supabase as any).from("message_presence").upsert({
      user_id: user.id,
      status,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  const loadTyping = async () => {
    const { data } = await (supabase as any).from("message_typing").select("*").gt("expires_at", new Date().toISOString());
    setTypingRows((data as TypingRow[]) ?? []);
  };

  const notifyIncoming = (payload: any) => {
    if (!user || payload.eventType !== "INSERT") return;
    const row = payload.new as MessageRow;
    if (!row || row.sender_id === user.id) return;
    const threadId = row.recipient_id ? `direct-${row.sender_id}` : row.request_id ? `request-${row.request_id}` : "";
    if (!threadId || muted.has(threadId)) return;
    playMessageSound();
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const title = profiles.get(row.sender_id)?.full_name || profiles.get(row.sender_id)?.username || "New message";
    if (Notification.permission === "granted") {
      new Notification(title, { body: row.message || attachmentSubtitle(row) || "Sent an attachment" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  };

  const updateTyping = async () => {
    if (!user || !selected) return;
    await (supabase as any).from("message_typing").upsert({
      thread_id: selected.id,
      user_id: user.id,
      expires_at: new Date(Date.now() + 4500).toISOString(),
    });
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(async () => {
      await (supabase as any).from("message_typing").delete().eq("thread_id", selected.id).eq("user_id", user.id);
    }, 4800);
  };

  const markThreadRead = async (thread: Thread) => {
    if (!user) return;
    const unread = thread.messages.filter((message) => isUnread(message, user.id) && !message.id.endsWith("-initial"));
    if (!unread.length) return;
    setThreads((current) => current.map((item) => item.id === thread.id ? {
      ...item,
      unreadCount: 0,
      messages: item.messages.map((message) => ({ ...message, read: true, read_by: Array.from(new Set([...(message.read_by ?? []), user.id])) })),
    } : item));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("syncup_message_reads_updated"));

    await Promise.all(unread.map((message) => {
      const table = thread.type === "direct" ? "direct_messages" : "join_request_messages";
      const readBy = Array.from(new Set([...(message.read_by ?? []), user.id]));
      return (supabase as any)
        .from(table)
        .update(thread.type === "direct" ? { read: true, read_by: readBy } : { read_by: readBy })
        .eq("id", message.id)
        .then(async (result: { error?: { message?: string } | null }) => {
          if (result.error && isMissingMessageMetadata(result.error)) {
            saveLocalReadFallback(user.id, message.id);
            if (thread.type === "direct") {
              return (supabase as any).from("direct_messages").update({ read: true }).eq("id", message.id);
            }
            return { error: null };
          }
          return result;
        });
    }));
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selected || (!text.trim() && !attachments.length) || !selected.recipientId) return;
    const message = text.trim();
    setText("");
    setSending(true);
    if (attachments.length) {
      setSending(false);
      setText(message);
      showMessageSchemaError({ message: "attachment_names column is missing" });
      return;
    }
    const payload: Record<string, unknown> = {
      sender_id: user.id,
      message,
    };
    const enhancedPayload = {
      ...payload,
      delivered_at: new Date().toISOString(),
      read_by: [user.id],
      reply_to_id: replyTo?.id.endsWith("-initial") ? null : replyTo?.id ?? null,
    };
    const result = selected.type === "direct"
      ? await insertMessageWithFallback("direct_messages", { ...enhancedPayload, recipient_id: selected.recipientId }, { ...payload, recipient_id: selected.recipientId })
      : await insertMessageWithFallback("join_request_messages", { ...enhancedPayload, request_id: selected.requestId }, { ...payload, request_id: selected.requestId });
    setSending(false);
    if (result.error) {
      showMessageSchemaError(result.error);
      setText(message);
      return;
    }
    clearAttachments();
    setReplyTo(null);
    window.localStorage.removeItem(`${draftPrefix}${selected.id}`);
    if (!muted.has(selected.id)) {
      await supabase.from("notifications").insert({
        user_id: selected.recipientId,
        title: selected.type === "direct" ? "New direct message" : "New request message",
        message: selected.type === "direct" ? "You received a profile message." : `${selected.title} has a new message.`,
      });
    }
    await loadThreads({ silent: true });
    setSelectedId(selected.id);
    window.setTimeout(scrollToBottom, 60);
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !editing || !text.trim()) return;
    const table = selected.type === "direct" ? "direct_messages" : "join_request_messages";
    const updatedMessage = text.trim();
    const editedAt = new Date().toISOString();
    const result = await updateMessageWithFallback(table, editing.id, { message: updatedMessage, edited_at: editedAt }, { message: updatedMessage });
    if (result.error) {
      showMessageSchemaError(result.error);
      return;
    }
    setThreads((current) => current.map((thread) => thread.id === selected.id ? {
      ...thread,
      messages: thread.messages.map((item) => item.id === editing.id ? { ...item, message: updatedMessage, edited_at: item.edited_at ?? editedAt } : item),
      subtitle: thread.messages[thread.messages.length - 1]?.id === editing.id ? updatedMessage : thread.subtitle,
    } : thread));
    setEditing(null);
    setText("");
    await loadThreads({ silent: true });
  };

  const deleteMessageForMe = async (message: MessageRow) => {
    if (!user || !selected || message.id.endsWith("-initial")) return;
    const table = selected.type === "direct" ? "direct_messages" : "join_request_messages";
    const deletedFor = Array.from(new Set([...(message.deleted_for ?? []), user.id]));
    const { error } = await (supabase as any).from(table).update({ deleted_for: deletedFor }).eq("id", message.id);
    if (error) toast.error(error.message);
    setOpenMessageMenuId(null);
    await loadThreads({ silent: true });
  };

  const deleteMessageForEveryone = async (message: MessageRow) => {
    if (!user || !selected || message.sender_id !== user.id || message.id.endsWith("-initial")) return;
    const table = selected.type === "direct" ? "direct_messages" : "join_request_messages";
    const { error } = await (supabase as any).from(table).update({ deleted_for_everyone: true }).eq("id", message.id);
    if (error) toast.error(error.message);
    setOpenMessageMenuId(null);
    await loadThreads({ silent: true });
  };

  const deleteConversationForMe = async () => {
    if (!user || !selected) return;
    const confirmed = window.confirm("Delete this chat from your inbox?");
    if (!confirmed) return;

    const removableMessages = selected.messages.filter((message) => !message.id.endsWith("-initial"));
    saveLocalDeletedThread(user.id, selected.id, new Date().toISOString());
    setThreads((current) => current.filter((thread) => thread.id !== selected.id));
    setSelectedId((current) => current === selected.id ? null : current);
    setChatOpen(false);
    setPinnedOpen(false);
    setReplyTo(null);
    setEditing(null);
    setText("");
    setOpenMessageMenuId(null);

    await Promise.all(removableMessages.map((message) => {
      const table = selected.type === "direct" ? "direct_messages" : "join_request_messages";
      const deletedFor = Array.from(new Set([...(message.deleted_for ?? []), user.id]));
      return (supabase as any).from(table).update({ deleted_for: deletedFor }).eq("id", message.id);
    }));

    toast.success("Chat deleted from your inbox.");
    await loadThreads({ silent: true });
  };

  const toggleReaction = async (message: MessageRow, reaction: string) => {
    if (!user || !selected || message.id.endsWith("-initial")) return;
    const next = normalizeReactions(message.reactions);
    const users = new Set(next[reaction] ?? []);
    users.has(user.id) ? users.delete(user.id) : users.add(user.id);
    next[reaction] = [...users];
    const table = selected.type === "direct" ? "direct_messages" : "join_request_messages";
    setOpenMessageMenuId(null);
    setThreads((current) => current.map((thread) => thread.id === selected.id ? {
      ...thread,
      messages: thread.messages.map((item) => item.id === message.id ? { ...item, reactions: next } : item),
    } : thread));
    const { error } = await (supabase as any).from(table).update({ reactions: next }).eq("id", message.id);
    if (error) {
      if (isMissingMessageMetadata(error)) {
        saveLocalReactionFallback(user.id, message.id, next);
        return;
      }
      toast.error(error.message);
      await loadThreads({ silent: true });
      return;
    }
    await loadThreads({ silent: true });
  };

  const togglePin = async (message: MessageRow) => {
    if (!user || !selected || message.id.endsWith("-initial")) return;
    const pins = new Set(message.pinned_by ?? []);
    pins.has(user.id) ? pins.delete(user.id) : pins.add(user.id);
    const table = selected.type === "direct" ? "direct_messages" : "join_request_messages";
    const nextPins = [...pins];
    setOpenMessageMenuId(null);
    setPinnedOpen(nextPins.length > 0);
    setThreads((current) => current.map((thread) => thread.id === selected.id ? {
      ...thread,
      messages: thread.messages.map((item) => item.id === message.id ? { ...item, pinned_by: nextPins } : item),
    } : thread));
    if (message.id.endsWith("-initial")) {
      saveLocalPinFallback(user.id, message.id, nextPins);
      return;
    }
    const { error } = await (supabase as any).from(table).update({ pinned_by: nextPins }).eq("id", message.id);
    if (error) {
      saveLocalPinFallback(user.id, message.id, nextPins);
      if (!isMissingMessageMetadata(error)) toast.info("Pinned on this device. Supabase blocked the shared pin update.");
      return;
    }
    await loadThreads({ silent: true });
  };

  const uploadAttachments = async (items: AttachmentDraft[]) => {
    if (!user || !items.length) return { urls: [], names: [], types: [] };
    const urls: string[] = [];
    const names: string[] = [];
    const types: string[] = [];
    for (const item of items) {
      const path = `${user.id}/${Date.now()}-${item.file.name}`;
      const { error } = await supabase.storage.from("message-attachments").upload(path, item.file, { upsert: true });
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from("message-attachments").getPublicUrl(path);
      urls.push(data.publicUrl);
      names.push(item.file.name);
      types.push(item.file.type || "application/octet-stream");
    }
    return { urls, names, types };
  };

  const addAttachments = (files: FileList | File[]) => {
    const next = Array.from(files).slice(0, 6).map((file) => ({
      file,
      previewUrl: file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((current) => [...current, ...next].slice(0, 6));
  };

  const clearAttachments = () => {
    attachments.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    setAttachments([]);
  };

  const toggleThreadSet = (key: string, threadId: string, label: string) => {
    const values = readStringSet(key);
    values.has(threadId) ? values.delete(threadId) : values.add(threadId);
    window.localStorage.setItem(key, JSON.stringify([...values]));
    setThreads((current) => [...current]);
    toast.success(label);
  };

  const scrollToMessage = (id: string) => {
    const target = messageRefs.current.get(id);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.animate(
      [
        { boxShadow: "0 0 0 0 rgba(34,211,238,0)" },
        { boxShadow: "0 0 0 3px rgba(34,211,238,.65)" },
        { boxShadow: "0 0 0 0 rgba(34,211,238,0)" },
      ],
      { duration: 1200 },
    );
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const activeSubmit = editing ? saveEdit : sendMessage;
  const unreadTotal = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 1279px)");
    const syncLayout = () => {
      setCompactChat(media.matches);
      if (!media.matches) setChatOpen(false);
    };
    syncLayout();
    media.addEventListener("change", syncLayout);
    return () => media.removeEventListener("change", syncLayout);
  }, []);

  return (
    <section className="space-y-6">
      <div className="glass-strong neon-border rounded-2xl p-5">
        <div>
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold">
              <MessageSquare className="h-7 w-7 text-cyan-300" />
              Messages
              {unreadTotal > 0 && <span className="rounded-full bg-cyan-300 px-2.5 py-1 text-xs font-bold text-[#0B0F19]">{unreadTotal}</span>}
            </h1>
            <p className="mt-2 text-white/55">Direct messages and team request conversations.</p>
          </div>
        </div>
      </div>

      <div className="grid min-h-[calc(100svh-11rem)] min-w-0 gap-4 lg:grid-cols-[0.36fr_0.64fr] lg:gap-6">
        <aside className="glass-strong min-w-0 rounded-2xl p-3 sm:p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-cyan-300"
              placeholder="Search people, messages, dates..."
            />
          </div>

          {loading ? (
            <ThreadSkeleton />
          ) : visibleThreads.length ? (
            <div className="space-y-2">
              {visibleThreads.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  active={selected?.id === thread.id}
                  presence={thread.profileId ? presence.get(thread.profileId) : undefined}
                  typingNames={typingRows.filter((row) => row.thread_id === thread.id && row.user_id !== user?.id && +new Date(row.expires_at) > Date.now()).map((row) => profiles.get(row.user_id)?.full_name || "Someone")}
                  muted={muted.has(thread.id)}
                  onOpen={() => {
                    setSelectedId(thread.id);
                    if (compactChat) setChatOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyInbox />
          )}
        </aside>

        <section className="glass-strong hidden min-w-0 overflow-hidden rounded-2xl xl:flex">
          {selected ? (
            <Conversation
              selected={selected}
              userId={user?.id}
              profiles={profiles}
              presence={selected.profileId ? presence.get(selected.profileId) : undefined}
              query={query}
              muted={muted.has(selected.id)}
              pinnedMessages={pinnedMessages}
              pinnedOpen={pinnedOpen}
              selectedTyping={selectedTyping}
              text={text}
              sending={sending}
              editing={editing}
              replyTo={replyTo}
              attachments={attachments}
              dragging={dragging}
              openMessageMenuId={openMessageMenuId}
              showJump={showJump}
              messageRefs={messageRefs}
              scrollRef={scrollRef}
              onTextChange={(value) => {
                setText(value);
                updateTyping();
              }}
              onSubmit={activeSubmit}
              onProfileOpen={(profile) => setQuickProfile(profile)}
              onPinnedToggle={() => setPinnedOpen(!pinnedOpen)}
              onMute={() => toggleThreadSet(muteKey, selected.id, muted.has(selected.id) ? "Conversation unmuted." : "Conversation muted.")}
              onDeleteConversation={deleteConversationForMe}
              onBack={undefined}
              onScroll={() => {
                const el = scrollRef.current;
                if (el) setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
              }}
              onScrollBottom={scrollToBottom}
              onScrollMessage={scrollToMessage}
              onReply={setReplyTo}
              onEdit={(message) => {
                setEditing(message);
                setText(message.message);
                setOpenMessageMenuId(null);
              }}
              onCancelComposer={() => {
                setEditing(null);
                setReplyTo(null);
                setText("");
              }}
              onCopy={(message) => navigator.clipboard.writeText(message.message)}
              onDeleteMe={deleteMessageForMe}
              onDeleteAll={deleteMessageForEveryone}
              onPin={togglePin}
              onReaction={toggleReaction}
              onMenu={setOpenMessageMenuId}
              onAttach={addAttachments}
              onRemoveAttachment={(index) => setAttachments((current) => current.filter((_, i) => i !== index))}
              onDrag={setDragging}
            />
          ) : (
            <NoChatSelected />
          )}
        </section>
      </div>

      {compactChat && chatOpen && selected && (
        <div className="message-mobile-sheet fixed inset-x-0 bottom-0 top-16 z-[45] overflow-hidden xl:hidden">
          <Conversation
            selected={selected}
            userId={user?.id}
            profiles={profiles}
            presence={selected.profileId ? presence.get(selected.profileId) : undefined}
            query={query}
            muted={muted.has(selected.id)}
            pinnedMessages={pinnedMessages}
            pinnedOpen={pinnedOpen}
            selectedTyping={selectedTyping}
            text={text}
            sending={sending}
            editing={editing}
            replyTo={replyTo}
            attachments={attachments}
            dragging={dragging}
            openMessageMenuId={openMessageMenuId}
            showJump={showJump}
            messageRefs={messageRefs}
            scrollRef={scrollRef}
            onTextChange={(value) => {
              setText(value);
              updateTyping();
            }}
            onSubmit={activeSubmit}
            onProfileOpen={(profile) => setQuickProfile(profile)}
            onPinnedToggle={() => setPinnedOpen(!pinnedOpen)}
            onMute={() => toggleThreadSet(muteKey, selected.id, muted.has(selected.id) ? "Conversation unmuted." : "Conversation muted.")}
            onDeleteConversation={deleteConversationForMe}
            onBack={() => setChatOpen(false)}
            onScroll={() => {
              const el = scrollRef.current;
              if (el) setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
            }}
            onScrollBottom={scrollToBottom}
            onScrollMessage={scrollToMessage}
            onReply={setReplyTo}
            onEdit={(message) => {
              setEditing(message);
              setText(message.message);
              setOpenMessageMenuId(null);
            }}
            onCancelComposer={() => {
              setEditing(null);
              setReplyTo(null);
              setText("");
            }}
            onCopy={(message) => navigator.clipboard.writeText(message.message)}
            onDeleteMe={deleteMessageForMe}
            onDeleteAll={deleteMessageForEveryone}
            onPin={togglePin}
            onReaction={toggleReaction}
            onMenu={setOpenMessageMenuId}
            onAttach={addAttachments}
            onRemoveAttachment={(index) => setAttachments((current) => current.filter((_, i) => i !== index))}
            onDrag={setDragging}
          />
        </div>
      )}

      {quickProfile && (
        <ProfileDrawer
          profile={quickProfile}
          threads={threads}
          onClose={() => setQuickProfile(null)}
        />
      )}
    </section>
  );
}

function Conversation({
  selected,
  userId,
  profiles,
  presence,
  query,
  muted,
  pinnedMessages,
  pinnedOpen,
  selectedTyping,
  text,
  sending,
  editing,
  replyTo,
  attachments,
  dragging,
  openMessageMenuId,
  showJump,
  messageRefs,
  scrollRef,
  onTextChange,
  onSubmit,
  onProfileOpen,
  onPinnedToggle,
  onMute,
  onDeleteConversation,
  onBack,
  onScroll,
  onScrollBottom,
  onScrollMessage,
  onReply,
  onEdit,
  onCancelComposer,
  onCopy,
  onDeleteMe,
  onDeleteAll,
  onPin,
  onReaction,
  onMenu,
  onAttach,
  onRemoveAttachment,
  onDrag,
}: {
  selected: Thread;
  userId?: string;
  profiles: Map<string, Profile>;
  presence?: Presence;
  query: string;
  muted: boolean;
  pinnedMessages: MessageRow[];
  pinnedOpen: boolean;
  selectedTyping: string[];
  text: string;
  sending: boolean;
  editing: MessageRow | null;
  replyTo: MessageRow | null;
  attachments: AttachmentDraft[];
  dragging: boolean;
  openMessageMenuId: string | null;
  showJump: boolean;
  messageRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  onTextChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onProfileOpen: (profile: Profile) => void;
  onPinnedToggle: () => void;
  onMute: () => void;
  onDeleteConversation: () => void;
  onBack?: () => void;
  onScroll: () => void;
  onScrollBottom: () => void;
  onScrollMessage: (id: string) => void;
  onReply: (message: MessageRow) => void;
  onEdit: (message: MessageRow) => void;
  onCancelComposer: () => void;
  onCopy: (message: MessageRow) => void;
  onDeleteMe: (message: MessageRow) => void;
  onDeleteAll: (message: MessageRow) => void;
  onPin: (message: MessageRow) => void;
  onReaction: (message: MessageRow, reaction: string) => void;
  onMenu: (id: string | null) => void;
  onAttach: (files: FileList | File[]) => void;
  onRemoveAttachment: (index: number) => void;
  onDrag: (value: boolean) => void;
}) {
  return (
    <div
      className={`relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden ${dragging ? "ring-2 ring-cyan-300/70" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        onDrag(true);
      }}
      onDragLeave={() => onDrag(false)}
      onDrop={(event) => {
        event.preventDefault();
        onDrag(false);
        onAttach(event.dataTransfer.files);
      }}
    >
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-white/10 p-3 sm:gap-3 sm:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {onBack && (
            <button onClick={onBack} className="shrink-0 rounded-xl p-2 hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <AvatarButton thread={selected} profile={selected.profileId ? profiles.get(selected.profileId) : undefined} onOpen={onProfileOpen} />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold sm:text-xl">{selected.title}</h2>
            <PresenceLine presence={presence} typing={selectedTyping} />
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5 sm:gap-2">
          <button onClick={onPinnedToggle} className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10" title="Pinned messages">
            <Pin className="h-4 w-4" />
          </button>
          <button onClick={onMute} className={`rounded-xl border border-white/10 p-2 hover:bg-white/10 ${muted ? "bg-cyan-300/15 text-cyan-100" : "bg-white/5"}`} title="Mute">
            <BellOff className="h-4 w-4" />
          </button>
          <button onClick={onDeleteConversation} className="rounded-xl border border-red-400/25 bg-red-500/10 p-2 text-red-100 hover:bg-red-500/15" title="Delete chat">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {pinnedOpen && (
        <div className="border-b border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-xs font-semibold text-white/50">Pinned messages</p>
          <div className="flex gap-2 overflow-x-auto">
            {pinnedMessages.length ? pinnedMessages.map((message) => (
              <button key={message.id} onClick={() => onScrollMessage(message.id)} className="max-w-xs shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10">
                {message.message || attachmentSubtitle(message)}
              </button>
            )) : <p className="text-sm text-white/45">No pinned messages yet.</p>}
          </div>
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4">
        {selected.messages.length ? selected.messages.map((message, index) => {
          const prev = selected.messages[index - 1];
          const showDate = !prev || dateLabel(prev.created_at) !== dateLabel(message.created_at);
          const grouped = prev?.sender_id === message.sender_id && !showDate && +new Date(message.created_at) - +new Date(prev.created_at) < 5 * 60 * 1000;
          const own = message.sender_id === userId;
          const profile = profiles.get(message.sender_id);
          const reply = message.reply_to_id ? selected.messages.find((item) => item.id === message.reply_to_id) : null;
          return (
            <div key={message.id} ref={(node) => node && messageRefs.current.set(message.id, node)} className="rounded-2xl">
              {showDate && <DateSeparator label={dateLabel(message.created_at)} />}
              <MessageBubble
                message={message}
                own={own}
                grouped={grouped}
                profile={profile}
                thread={selected}
                query={query}
                reply={reply}
                openMenu={openMessageMenuId === message.id}
                onProfileOpen={onProfileOpen}
                onScrollMessage={onScrollMessage}
                onReply={onReply}
                onEdit={onEdit}
                onCopy={onCopy}
                onDeleteMe={onDeleteMe}
                onDeleteAll={onDeleteAll}
                onPin={onPin}
                onReaction={onReaction}
                onMenu={onMenu}
              />
            </div>
          );
        }) : <NoMessages />}
        {selectedTyping.length > 0 && <TypingIndicator names={selectedTyping} />}
      </div>

      {showJump && (
        <button onClick={onScrollBottom} className="absolute bottom-24 right-6 grid h-10 w-10 place-items-center rounded-full bg-cyan-300 text-[#0B0F19] shadow-lg">
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      <Composer
        text={text}
        sending={sending}
        editing={editing}
        replyTo={replyTo}
        attachments={attachments}
        onSubmit={onSubmit}
        onTextChange={onTextChange}
        onCancel={onCancelComposer}
        onAttach={onAttach}
        onRemoveAttachment={onRemoveAttachment}
      />
    </div>
  );
}

function MessageBubble(props: {
  message: MessageRow;
  own: boolean;
  grouped: boolean;
  profile?: Profile;
  thread: Thread;
  query: string;
  reply: MessageRow | null;
  openMenu: boolean;
  onProfileOpen: (profile: Profile) => void;
  onScrollMessage: (id: string) => void;
  onReply: (message: MessageRow) => void;
  onEdit: (message: MessageRow) => void;
  onCopy: (message: MessageRow) => void;
  onDeleteMe: (message: MessageRow) => void;
  onDeleteAll: (message: MessageRow) => void;
  onPin: (message: MessageRow) => void;
  onReaction: (message: MessageRow, reaction: string) => void;
  onMenu: (id: string | null) => void;
}) {
  const { message, own, grouped, profile, thread, query, reply, openMenu } = props;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`group flex items-end gap-2 ${own ? "justify-end" : "justify-start"} ${grouped ? "mt-1" : "mt-3"}`}>
      {!own && !grouped ? (
        <button onClick={() => profile && props.onProfileOpen(profile)} className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-[11px] font-bold ring-1 ring-white/10">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(profile ?? { full_name: thread.title, username: null } as Profile)}
        </button>
      ) : <span className="h-8 w-8 shrink-0" />}
      <div className={`relative min-w-0 max-w-[calc(100vw-5.5rem)] sm:max-w-[82%] ${own ? "items-end" : "items-start"}`}>
        <div className={`relative rounded-2xl px-3 py-2.5 text-sm sm:px-4 sm:py-3 ${own ? "message-bubble-own bg-cyan-300/20 text-cyan-50" : "message-bubble-other bg-white/8 text-white/75"} ${grouped ? own ? "rounded-tr-md" : "rounded-tl-md" : ""}`}>
          <button onClick={() => props.onMenu(openMenu ? null : message.id)} className="message-action-button absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg border border-white/10 sm:hidden" title="Message actions">
            <MoreVertical className="h-4 w-4" />
          </button>
          {(message.pinned_by ?? []).length > 0 && (
            <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-cyan-300/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
              <Pin className="h-3 w-3" />
              Pinned
            </div>
          )}
          {reply && (
            <button onClick={() => props.onScrollMessage(reply.id)} className="mb-2 block w-full rounded-lg border-l-2 border-cyan-300 bg-black/15 px-3 py-2 text-left text-xs text-white/55">
              Replying to: {reply.message || attachmentSubtitle(reply)}
            </button>
          )}
          {message.message && <p className="whitespace-pre-wrap break-words pr-6 [overflow-wrap:anywhere] sm:pr-0">{highlight(message.message, query)}</p>}
          <Attachments message={message} />
          <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-white/35">
            {message.edited_at && <span>edited</span>}
            <span>{smartTime(message.created_at)}</span>
            {own && <ReadReceipt message={message} />}
          </div>
        </div>
        <ReactionCounts message={message} onReaction={(reaction) => props.onReaction(message, reaction)} />
        <div className={`absolute top-0 hidden gap-1 sm:group-hover:flex ${own ? "right-full mr-2" : "left-full ml-2"}`}>
          <IconButton title="Reply" icon={Reply} onClick={() => props.onReply(message)} />
          <IconButton title="React" icon={SmilePlus} onClick={() => props.onMenu(openMenu ? null : message.id)} />
          <IconButton title="Copy" icon={Copy} onClick={() => props.onCopy(message)} />
          <IconButton title={(message.pinned_by ?? []).length ? "Unpin" : "Pin"} icon={Pin} onClick={() => props.onPin(message)} />
          {own && <IconButton title="Edit" icon={Edit3} onClick={() => props.onEdit(message)} />}
          <IconButton title="More" icon={MoreVertical} onClick={() => props.onMenu(openMenu ? null : message.id)} />
        </div>
        {openMenu && (
          <div className={`message-action-menu absolute top-9 z-20 w-56 rounded-xl border border-white/10 p-2 shadow-2xl ${own ? "right-0" : "left-0"}`}>
            <div className="mb-2 flex gap-1 px-1">
              {reactions.map((reaction) => (
                <button key={reaction} onClick={() => props.onReaction(message, reaction)} className="rounded-lg p-1.5 hover:bg-white/10">{reaction}</button>
              ))}
            </div>
            <MenuButton icon={Reply} label="Reply" onClick={() => props.onReply(message)} />
            <MenuButton icon={Copy} label="Copy" onClick={() => props.onCopy(message)} />
            <MenuButton icon={Pin} label={(message.pinned_by ?? []).length ? "Unpin" : "Pin"} onClick={() => props.onPin(message)} />
            <MenuButton icon={Trash2} label="Delete for me" onClick={() => props.onDeleteMe(message)} />
            {own && (
              <>
                <MenuButton icon={Edit3} label="Edit" onClick={() => props.onEdit(message)} />
                <MenuButton icon={Trash2} label="Delete for everyone" danger onClick={() => props.onDeleteAll(message)} />
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Composer({ text, sending, editing, replyTo, attachments, onSubmit, onTextChange, onCancel, onAttach, onRemoveAttachment }: {
  text: string;
  sending: boolean;
  editing: MessageRow | null;
  replyTo: MessageRow | null;
  attachments: AttachmentDraft[];
  onSubmit: (event: React.FormEvent) => void;
  onTextChange: (value: string) => void;
  onCancel: () => void;
  onAttach: (files: FileList | File[]) => void;
  onRemoveAttachment: (index: number) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="message-composer sticky bottom-0 border-t border-white/10 p-3 backdrop-blur-xl sm:p-4">
      {(editing || replyTo) && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
          <span className="truncate text-white/60">{editing ? "Editing message" : `Replying to: ${replyTo?.message || attachmentSubtitle(replyTo)}`}</span>
          <button type="button" onClick={onCancel} className="rounded-lg p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {attachments.map((item, index) => (
            <div key={`${item.file.name}-${index}`} className="relative shrink-0 rounded-xl border border-white/10 bg-white/5 p-2">
              {item.previewUrl && item.file.type.startsWith("image/") ? <img src={item.previewUrl} alt="" className="h-20 w-24 rounded-lg object-cover" /> : <FileText className="h-10 w-10 text-cyan-300" />}
              <p className="mt-1 max-w-24 truncate text-[10px] text-white/55">{item.file.name}</p>
              <button type="button" onClick={() => onRemoveAttachment(index)} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 sm:h-12 sm:w-12">
          <Paperclip className="h-5 w-5" />
          <input type="file" multiple className="hidden" onChange={(event) => event.target.files && onAttach(event.target.files)} />
        </label>
        <input
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition focus:border-cyan-300 sm:min-h-12 sm:px-4 sm:py-3"
          placeholder="Write a message..."
        />
        <button disabled={sending || (!text.trim() && !attachments.length)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-sm font-semibold disabled:opacity-60 sm:flex sm:h-12 sm:w-auto sm:gap-2 sm:px-5">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline">{editing ? "Save" : "Send"}</span>
        </button>
      </div>
    </form>
  );
}

function ThreadCard({ thread, active, presence, typingNames, muted, onOpen }: { thread: Thread; active: boolean; presence?: Presence; typingNames: string[]; muted: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className={`w-full overflow-hidden rounded-2xl border p-3 text-left transition sm:p-4 ${active ? "border-cyan-300/50 bg-cyan-300/10" : thread.unreadCount ? "border-cyan-300/30 bg-cyan-300/5" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
      <div className="flex items-center gap-3">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-sm font-bold ring-1 ring-white/10 sm:h-11 sm:w-11">
          {thread.avatarUrl ? <img src={thread.avatarUrl} alt="" className="h-full w-full object-cover" /> : thread.profileId ? initials({ full_name: thread.title, username: null } as Profile) : <Users className="h-4 w-4" />}
          {presence && <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-[#0B0F19] ${presenceColor(presence)}`} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold">{thread.title}</span>
            {thread.unreadCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cyan-300 px-1 text-[10px] font-bold text-[#0B0F19]">{thread.unreadCount}</span>}
          </span>
          <span className={`block truncate text-xs ${typingNames.length ? "text-cyan-200" : "text-white/50"}`}>
            {typingNames.length ? `${typingNames.slice(0, 2).join(", ")} typing...` : thread.subtitle}
          </span>
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-white/35">
        <span>{smartDateTime(thread.updatedAt)}</span>
        {muted && <BellOff className="h-3.5 w-3.5" />}
      </div>
    </button>
  );
}

function AvatarButton({ thread, profile, onOpen }: { thread: Thread; profile?: Profile; onOpen: (profile: Profile) => void }) {
  return (
    <button onClick={() => profile && onOpen(profile)} className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-sm font-bold ring-1 ring-white/10 sm:h-12 sm:w-12 sm:text-base">
      {thread.avatarUrl ? <img src={thread.avatarUrl} alt="" className="h-full w-full object-cover" /> : thread.profileId ? initials({ full_name: thread.title, username: null } as Profile) : <Users className="h-5 w-5" />}
    </button>
  );
}

function ProfileDrawer({ profile, threads, onClose }: { profile: Profile; threads: Thread[]; onClose: () => void }) {
  const sharedThreads = threads.filter((thread) => thread.profileId === profile.id);
  return (
    <motion.aside initial={{ x: 380 }} animate={{ x: 0 }} className="message-profile-drawer fixed bottom-0 right-0 top-0 z-[100] w-full max-w-sm border-l border-white/10 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex justify-end">
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>
      <div className="text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 text-2xl font-bold">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(profile)}
        </div>
        <h2 className="mt-4 text-2xl font-bold">{profile.full_name || profile.username || "SyncUp user"}</h2>
        <p className="text-sm text-cyan-200">@{profile.username || "profile"}</p>
      </div>
      <p className="mt-5 rounded-2xl bg-white/5 p-4 text-sm leading-6 text-white/60">{profile.bio || "No bio added yet."}</p>
      <div className="mt-5">
        <p className="text-xs font-semibold text-white/45">Skills</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(profile.skills ?? []).length ? profile.skills?.map((skill) => <span key={skill} className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs text-cyan-100">{skill}</span>) : <span className="text-sm text-white/45">No skills listed.</span>}
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold">Recent activity</p>
        <p className="mt-2 text-sm text-white/55">{sharedThreads.reduce((sum, thread) => sum + thread.messages.length, 0)} messages in this inbox.</p>
      </div>
      <Link to="/profiles/$id" params={{ id: profile.id }} className="mt-5 flex justify-center rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-[#0B0F19]">
        Open full profile
      </Link>
    </motion.aside>
  );
}

function Attachments({ message }: { message: MessageRow }) {
  const urls = message.attachment_urls ?? [];
  if (!urls.length) return null;
  return (
    <div className="mt-3 grid gap-2">
      {urls.map((url, index) => {
        const type = message.attachment_types?.[index] ?? "";
        const name = message.attachment_names?.[index] ?? "Attachment";
        if (type.startsWith("image/")) return <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={name} className="max-h-72 rounded-xl object-cover" /></a>;
        if (type.startsWith("video/")) return <video key={url} src={url} controls className="max-h-72 rounded-xl" />;
        return (
          <a key={url} href={url} download className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs hover:bg-white/10">
            {type === "application/pdf" ? <FileText className="h-4 w-4 text-red-200" /> : <Download className="h-4 w-4 text-cyan-200" />}
            <span className="truncate">{name}</span>
          </a>
        );
      })}
    </div>
  );
}

function ReactionCounts({ message, onReaction }: { message: MessageRow; onReaction: (reaction: string) => void }) {
  const entries = Object.entries(normalizeReactions(message.reactions)).filter(([, users]) => users.length);
  if (!entries.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([reaction, users]) => (
        <button key={reaction} onClick={() => onReaction(reaction)} className="message-reaction rounded-full border border-white/10 px-2 py-0.5 text-xs" title={users.join(", ")}>
          {reaction} {users.length}
        </button>
      ))}
    </div>
  );
}

function ReadReceipt({ message }: { message: MessageRow }) {
  const readCount = (message.read_by ?? []).filter((id) => id !== message.sender_id).length;
  if (readCount > 0 || message.read) return <span title={`${readCount || 1} read`}><CheckCheck className="h-3.5 w-3.5 text-cyan-200" /></span>;
  if (message.delivered_at) return <span title="Delivered"><CheckCheck className="h-3.5 w-3.5" /></span>;
  return <span title="Sent"><Check className="h-3.5 w-3.5" /></span>;
}

function PresenceLine({ presence, typing }: { presence?: Presence; typing: string[] }) {
  if (typing.length) return <span className="flex items-center gap-2 text-xs text-cyan-200">{typing.join(", ")} {typing.length === 1 ? "is" : "are"} typing <TypingDots /></span>;
  if (!presence) return <p className="text-xs text-white/45">Offline</p>;
  const label = presence.status === "online" ? "Online" : presence.status === "away" ? "Away" : `Last seen ${smartDateTime(presence.last_seen_at)}`;
  return <p className="text-xs text-white/45">{label}</p>;
}

function TypingIndicator({ names }: { names: string[] }) {
  return <div className="ml-10 flex items-center gap-2 text-sm text-cyan-200">{names.join(", ")} typing <TypingDots /></div>;
}

function TypingDots() {
  return <span className="inline-flex gap-1"><span className="animate-bounce">●</span><span className="animate-bounce [animation-delay:120ms]">●</span><span className="animate-bounce [animation-delay:240ms]">●</span></span>;
}

function DateSeparator({ label }: { label: string }) {
  return <div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-white/10" /><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/45">{label}</span><span className="h-px flex-1 bg-white/10" /></div>;
}

function NoChatSelected() {
  return (
    <div className="grid w-full place-items-center p-10 text-center">
      <div className="grid h-28 w-28 place-items-center rounded-full bg-cyan-300/10">
        <MessageSquare className="h-12 w-12 text-cyan-200" />
      </div>
      <h2 className="mt-5 text-2xl font-bold">Select a conversation to start messaging.</h2>
      <p className="mt-2 max-w-sm text-sm text-white/50">Choose a profile chat or team request thread from your inbox.</p>
      <Link to="/discover" className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#0B0F19]">Find builders</Link>
    </div>
  );
}

function NoMessages() {
  return <div className="grid h-full place-items-center rounded-2xl bg-white/5 p-8 text-center text-sm text-white/45">No messages yet. Start the conversation.</div>;
}

function EmptyInbox() {
  return <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-white/55">No conversations yet. Open a profile and send a message.</div>;
}

function ThreadSkeleton() {
  return <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-white/5" />)}</div>;
}

function IconButton({ title, icon: Icon, onClick }: { title: string; icon: typeof Reply; onClick: () => void }) {
  return <button title={title} onClick={onClick} className="message-action-button grid h-8 w-8 place-items-center rounded-lg border border-white/10"><Icon className="h-4 w-4" /></button>;
}

function MenuButton({ icon: Icon, label, danger, onClick }: { icon: typeof Reply; label: string; danger?: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10 ${danger ? "text-red-200" : "text-white/75"}`}><Icon className="h-3.5 w-3.5" />{label}</button>;
}

function highlight(text: string, query: string) {
  const needle = query.trim();
  if (!needle || !text.toLowerCase().includes(needle.toLowerCase())) return text;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  return <>{text.slice(0, index)}<mark className="rounded bg-cyan-300 px-0.5 text-[#0B0F19]">{text.slice(index, index + needle.length)}</mark>{text.slice(index + needle.length)}</>;
}

function isVisibleFor(userId: string) {
  return (message: MessageRow) => !message.deleted_for_everyone && !(message.deleted_for ?? []).includes(userId);
}

function isUnread(message: MessageRow, userId: string) {
  if (message.sender_id === userId) return false;
  return !(message.read_by ?? []).includes(userId) && !message.read;
}

function normalizeReactions(value: MessageRow["reactions"]) {
  if (!value || Array.isArray(value) || typeof value !== "object") return {} as Record<string, string[]>;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, users]) => Array.isArray(users))
      .map(([reaction, users]) => [reaction, [...new Set(users as string[])]]),
  ) as Record<string, string[]>;
}

function readLocalReactionFallback(userId: string) {
  if (typeof window === "undefined") return {} as Record<string, Record<string, string[]>>;
  try {
    return JSON.parse(window.localStorage.getItem(`syncup_local_reactions_${userId}`) ?? "{}") as Record<string, Record<string, string[]>>;
  } catch {
    return {};
  }
}

function saveLocalReactionFallback(userId: string, messageId: string, reactionsValue: Record<string, string[]>) {
  if (typeof window === "undefined") return;
  const current = readLocalReactionFallback(userId);
  current[messageId] = reactionsValue;
  window.localStorage.setItem(`syncup_local_reactions_${userId}`, JSON.stringify(current));
}

function applyLocalReactionFallback(message: MessageRow, fallback: Record<string, Record<string, string[]>>) {
  return fallback[message.id] ? { ...message, reactions: fallback[message.id] } : message;
}

function readLocalPinFallback(userId: string) {
  if (typeof window === "undefined") return {} as Record<string, string[]>;
  try {
    return JSON.parse(window.localStorage.getItem(`syncup_local_pins_${userId}`) ?? "{}") as Record<string, string[]>;
  } catch {
    return {};
  }
}

function saveLocalPinFallback(userId: string, messageId: string, pinnedBy: string[]) {
  if (typeof window === "undefined") return;
  const current = readLocalPinFallback(userId);
  if (pinnedBy.length) current[messageId] = pinnedBy;
  else delete current[messageId];
  window.localStorage.setItem(`syncup_local_pins_${userId}`, JSON.stringify(current));
}

function applyLocalPinFallback(message: MessageRow, fallback: Record<string, string[]>) {
  return fallback[message.id] ? { ...message, pinned_by: fallback[message.id] } : message;
}

function readLocalReadFallback(userId: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem(`syncup_local_reads_${userId}`) ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function saveLocalReadFallback(userId: string, messageId: string) {
  if (typeof window === "undefined") return;
  const current = readLocalReadFallback(userId);
  current.add(messageId);
  window.localStorage.setItem(`syncup_local_reads_${userId}`, JSON.stringify([...current]));
  window.dispatchEvent(new Event("syncup_message_reads_updated"));
}

function applyLocalReadFallback(message: MessageRow, fallback: Set<string>, userId: string) {
  if (!fallback.has(message.id)) return message;
  return { ...message, read: true, read_by: Array.from(new Set([...(message.read_by ?? []), userId])) };
}

function readLocalDeletedThreads(userId: string) {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try {
    return JSON.parse(window.localStorage.getItem(`syncup_deleted_threads_${userId}`) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function saveLocalDeletedThread(userId: string, threadId: string, deletedAt: string) {
  if (typeof window === "undefined") return;
  const current = readLocalDeletedThreads(userId);
  current[threadId] = deletedAt;
  window.localStorage.setItem(`syncup_deleted_threads_${userId}`, JSON.stringify(current));
}

function isAfterDeletedThreadCutoff(threadId: string, createdAt: string, deletedThreads: Record<string, string>) {
  const cutoff = deletedThreads[threadId];
  if (!cutoff) return true;
  return +new Date(createdAt) > +new Date(cutoff);
}

async function insertMessageWithFallback(table: string, enhancedPayload: Record<string, unknown>, basePayload: Record<string, unknown>) {
  const enhanced = await (supabase as any).from(table).insert(enhancedPayload).select("*").single();
  if (!enhanced.error || !isMissingMessageMetadata(enhanced.error)) return enhanced;
  return (supabase as any).from(table).insert(basePayload).select("*").single();
}

async function updateMessageWithFallback(table: string, messageId: string, enhancedPayload: Record<string, unknown>, basePayload: Record<string, unknown>) {
  const enhanced = await (supabase as any).from(table).update(enhancedPayload).eq("id", messageId);
  if (!enhanced.error || !isMissingMessageMetadata(enhanced.error)) return enhanced;
  return (supabase as any).from(table).update(basePayload).eq("id", messageId);
}

function isMissingMessageMetadata(error: { message?: string }) {
  const message = error.message ?? "";
  return message.includes("schema cache") || message.includes("Could not find");
}

function showMessageSchemaError(error: { message?: string }) {
  const message = error.message ?? "Message action failed.";
  if (isMissingMessageMetadata(error)) {
    toast.error("This messaging feature needs the latest Supabase migration. Normal text messages still work.");
    return;
  }
  toast.error(message);
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce((map, item) => {
    const groupKey = key(item);
    const next = map.get(groupKey) ?? [];
    next.push(item);
    map.set(groupKey, next);
    return map;
  }, new Map<string, T[]>());
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function readStringSet(key: string) {
  if (!key || typeof window === "undefined") return new Set<string>();
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function attachmentSubtitle(message?: MessageRow | null) {
  if (!message?.attachment_urls?.length) return "";
  return `${message.attachment_urls.length} attachment${message.attachment_urls.length === 1 ? "" : "s"}`;
}

function dateLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function smartTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function smartDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function presenceColor(presence: Presence) {
  if (presence.status === "online") return "bg-emerald-400";
  if (presence.status === "away") return "bg-yellow-300";
  return "bg-gray-400";
}

function playMessageSound() {
  if (typeof window === "undefined") return;
  const mutedAll = window.localStorage.getItem("syncup_mute_all_notifications") === "true";
  if (mutedAll) return;
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const audio = new AudioContextCtor();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 720;
    gain.gain.value = 0.035;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.08);
  } catch {
    // Browser autoplay policies can block this until the user interacts.
  }
}
