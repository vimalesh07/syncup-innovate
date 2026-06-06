import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
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
  Reply,
  Search,
  Send,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { SafeAvatar } from "@/components/app/SafeAvatar";
import { supabase } from "@/integrations/supabase/client";
import { Profile } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { directMessageNotification, insertNotification } from "@/lib/notifications";
import { getUnreadMessagesCount, isUnreadMessage, notifyUnreadMessagesChanged } from "@/lib/message-unread";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages | SyncUp" }] }),
  component: MessagesRoute,
});

const reactions = ["👍", "❤️", "🔥", "😂", "😮", "😢"];

type MessageKind = "direct" | "request";
type InboxFilter = "all" | "direct" | "requests" | "unread";

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id?: string;
  request_id?: string;
  message: string;
  created_at: string;
  delivery_status?: "sending" | "failed";
  read?: boolean | null;
  deleted_for?: string[] | null;
  deleted_for_everyone?: boolean | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
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
  required_skills?: string[] | null;
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
  requestStatus?: string;
  requestMessage?: string | null;
  requestUserId?: string;
  teamLeaderId?: string;
  teamName?: string;
  requestSkills?: string[] | null;
};

type AttachmentDraft = {
  file: File;
  previewUrl?: string;
};

type SharedPostMessage = {
  author: string;
  content: string;
};

export function MessagesRoute() {
  return (
    <ProtectedPage>
      <PlatformShell>
        <MessagesPage />
      </PlatformShell>
    </ProtectedPage>
  );
}

function MessagesPage() {
  const { profile, user } = useAuth();
  const location = useLocation();
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
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const [quickProfile, setQuickProfile] = useState<Profile | null>(null);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [dragging, setDragging] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("syncup_mute_all_notifications") !== "true";
  });
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const threadsRef = useRef<Thread[]>([]);
  const profilesRef = useRef<Map<string, Profile>>(new Map());
  const mutedRef = useRef<Set<string>>(new Set());

  const routeConversationId = useMemo(() => {
    const match = location.pathname.match(/^\/messages\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [location.pathname]);
  const directProfileId = useMemo(() => {
    const search = location.searchStr?.startsWith("?") ? location.searchStr.slice(1) : location.searchStr ?? "";
    const direct = new URLSearchParams(search).get("direct");
    return direct || directProfileIdFromThreadId(routeConversationId);
  }, [location.searchStr, routeConversationId]);
  const requestedConversationId = routeConversationId || (directProfileId && directProfileId !== user?.id ? `direct-${directProfileId}` : null);
  const selected = useMemo(() => {
    if (requestedConversationId) return threads.find((thread) => String(thread.id) === String(requestedConversationId)) ?? null;
    if (selectedId) return threads.find((thread) => thread.id === selectedId) ?? null;
    return threads[0] ?? null;
  }, [threads, selectedId, requestedConversationId]);
  const muteKey = user ? `syncup_muted_threads_${user.id}` : "";
  const draftPrefix = user ? `syncup_message_draft_${user.id}_` : "";
  const muted = useMemo(() => readStringSet(muteKey), [muteKey, threads.length]);

  const visibleThreads = useMemo(() => {
    const now = Date.now();
    return threads
      .filter((thread) => {
        if (filter === "direct" && thread.type !== "direct") return false;
        if (filter === "requests" && thread.type !== "request") return false;
        if (filter === "unread" && thread.unreadCount === 0) return false;
        if (!query.trim()) return true;
        const needle = query.toLowerCase();
        return [
          thread.title,
          thread.subtitle,
          thread.type === "direct" ? "direct" : "team request",
          thread.requestStatus,
          thread.teamName,
          new Date(thread.updatedAt).toLocaleDateString(),
          ...thread.messages.map((message) => `${message.message} ${new Date(message.created_at).toLocaleDateString()}`),
        ].filter(Boolean).some((value) => `${value}`.toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        const aTyping = typingRows.some((row) => row.thread_id === a.id && row.user_id !== user?.id && +new Date(row.expires_at) > now);
        const bTyping = typingRows.some((row) => row.thread_id === b.id && row.user_id !== user?.id && +new Date(row.expires_at) > now);
        if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
        if (Number(aTyping) !== Number(bTyping)) return Number(bTyping) - Number(aTyping);
        return +new Date(b.updatedAt) - +new Date(a.updatedAt);
      });
  }, [threads, query, filter, typingRows, user?.id]);

  useEffect(() => {
    selectedIdRef.current = selected?.id ?? selectedId;
  }, [selected?.id, selectedId]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (!openMessageMenuId || typeof document === "undefined") return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".message-action-menu, .message-action-button")) return;
      setOpenMessageMenuId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMessageMenuId(null);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMessageMenuId]);

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
    const teamsResult = allTeamIds.length ? await supabase.from("teams").select("id, team_name, leader_id, required_skills").in("id", allTeamIds) : { data: [] };
    const teamMap = new Map([...(teamsResult.data as Team[] ?? []), ...leaderTeams].map((team) => [team.id, team]));

    const localReactions = readLocalReactionFallback(user.id);
    const localReads = readLocalReadFallback(user.id);
    const directRows = ((directResult.data as MessageRow[]) ?? [])
      .filter(isVisibleFor(user.id))
      .filter((message) => {
        const otherId = message.sender_id === user.id ? message.recipient_id! : message.sender_id;
        return isAfterDeletedThreadCutoff(`direct-${otherId}`, message.created_at, deletedThreads);
      })
      .map((message) => applyLocalReadFallback(applyLocalReactionFallback(message, localReactions), localReads, user.id));
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
      const threadId = `direct-${otherId}`;
      const active = selectedIdRef.current === threadId;
      return {
        id: threadId,
        type: "direct" as const,
        title: profile?.full_name || profile?.username || "SyncUp user",
        subtitle: last?.message || attachmentSubtitle(last) || "Direct message",
        avatarUrl: profile?.avatar_url,
        profileId: otherId,
        recipientId: otherId,
        updatedAt: last?.created_at ?? new Date().toISOString(),
        messages,
        unreadCount: active ? 0 : messages.filter((message) => isUnread(message, user.id)).length,
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
        .map((message) => applyLocalReadFallback(applyLocalReactionFallback(message, localReactions), localReads, user.id)),
      (message) => message.request_id ?? "",
    );
    const requestThreads = requests.map((request) => {
      const team = teamMap.get(request.team_id);
      const otherId = request.user_id === user.id ? team?.leader_id : request.user_id;
      const profile = otherId ? profileMap.get(otherId) : null;
      const rows = requestMessageMap.get(request.id) ?? [];
      const threadId = `request-${request.id}`;
      const active = selectedIdRef.current === threadId;
      const visibleMessages = request.message
        ? [{ id: `${request.id}-initial`, sender_id: request.user_id, request_id: request.id, message: request.message, created_at: request.created_at, read_by: [user.id] }, ...rows]
        : rows;
      const last = visibleMessages[visibleMessages.length - 1];
      return {
        id: threadId,
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
        unreadCount: active ? 0 : visibleMessages.filter((message) => isUnread(message, user.id)).length,
        requestStatus: request.status,
        requestMessage: request.message,
        requestUserId: request.user_id,
        teamLeaderId: team?.leader_id,
        teamName: team?.team_name,
        requestSkills: team?.required_skills ?? null,
      };
    });

    const nextThreads = [...directThreads, ...requestThreads];
    setThreads((current) => mergeOptimisticThreads(current, nextThreads));
    setSelectedId((current) => {
      if (requestedConversationId && nextThreads.some((thread) => String(thread.id) === String(requestedConversationId))) return requestedConversationId;
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
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, handleRealtimeMessage)
      .on("postgres_changes", { event: "*", schema: "public", table: "join_request_messages" }, handleRealtimeMessage)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_presence" }, (payload) => {
        const row = (payload.new ?? payload.old) as Presence;
        if (!row?.user_id) return;
        setPresence((current) => new Map(current).set(row.user_id, row));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_typing" }, () => loadTyping())
      .subscribe();

    const refreshTimer = window.setInterval(() => {
      loadTyping();
      if (!document.hidden) loadThreads({ silent: true });
      upsertPresence(document.hidden ? "away" : "online");
    }, 2500);

    return () => {
      document.removeEventListener("visibilitychange", markAway);
      window.removeEventListener("beforeunload", markOffline);
      window.clearInterval(refreshTimer);
      supabase.removeChannel(channel);
      upsertPresence("offline");
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user || !requestedConversationId) return;
    setFilter("all");
    setSelectedId(requestedConversationId);
    if (compactChat) setChatOpen(true);
    void loadThreads({ silent: true });
  }, [requestedConversationId, user?.id]);

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

  useEffect(() => {
    if (!selected || showJump) return;
    window.setTimeout(scrollToBottom, 60);
  }, [selected?.messages.length, selected?.id, showJump]);

  useEffect(() => {
    if (!selected || !user) return;
    const hasUnread = selected.messages.some((message) => isUnread(message, user.id) && !message.id.endsWith("-initial"));
    if (hasUnread) void markThreadRead(selected);
  }, [selected?.messages.length, selected?.id, user?.id]);

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
    if (!threadId || mutedRef.current.has(threadId)) return;
    playMessageSound();
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const senderProfile = profilesRef.current.get(row.sender_id);
    const title = senderProfile?.full_name || senderProfile?.username || "New message";
    if (Notification.permission === "granted") {
      new Notification(title, { body: row.message || attachmentSubtitle(row) || "Sent an attachment" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  };

  const shouldAutoScroll = () => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 220;
  };

  const updateThreadWithMessage = (message: MessageRow, options: { replaceTempId?: string; forceRead?: boolean } = {}) => {
    if (!user) return;
    const threadId = getThreadIdForMessage(message, user.id);
    if (!threadId) return;
    const active = selectedIdRef.current === threadId;
    const nextMessage = options.forceRead || (active && message.sender_id !== user.id)
      ? { ...message, read: true, read_by: Array.from(new Set([...(message.read_by ?? []), user.id])) }
      : message;

    setThreads((current) => {
      let found = false;
      const next = current.map((thread) => {
        if (thread.id !== threadId) return thread;
        found = true;
        const messages = mergeThreadMessages(thread.messages, nextMessage, options.replaceTempId);
        const last = messages[messages.length - 1];
        return {
          ...thread,
          messages,
          subtitle: last?.message || attachmentSubtitle(last) || thread.subtitle,
          updatedAt: last?.created_at ?? thread.updatedAt,
          unreadCount: active ? 0 : messages.filter((item) => isUnread(item, user.id)).length,
        };
      });

      if (found || message.request_id || message.sender_id === user.id) return next;

      const otherId = message.sender_id === user.id ? message.recipient_id : message.sender_id;
      if (!otherId) return next;
      const profile = profilesRef.current.get(otherId);
      const messages = [nextMessage];
      return [{
        id: threadId,
        type: "direct",
        title: profile?.full_name || profile?.username || "SyncUp user",
        subtitle: nextMessage.message || attachmentSubtitle(nextMessage) || "Direct message",
        avatarUrl: profile?.avatar_url,
        profileId: otherId,
        recipientId: otherId,
        updatedAt: nextMessage.created_at,
        messages,
        unreadCount: active ? 0 : messages.filter((item) => isUnread(item, user.id)).length,
      }, ...next];
    });
  };

  const markRealtimeMessageRead = async (message: MessageRow) => {
    if (!user || message.sender_id === user.id || message.id.startsWith("temp-")) return;
    const table = message.request_id ? "join_request_messages" : "direct_messages";
    const readBy = Array.from(new Set([...(message.read_by ?? []), user.id]));
    saveLocalReadFallback(user.id, message.id);
    const result = await (supabase as any)
      .from(table)
      .update(message.request_id ? { read_by: readBy } : { read: true, read_by: readBy })
      .eq("id", message.id);
    if (!result.error) notifyUnreadMessagesChanged();
    if (result.error && isMissingMessageMetadata(result.error)) {
      saveLocalReadFallback(user.id, message.id);
      if (!message.request_id) {
        await (supabase as any).from("direct_messages").update({ read: true }).eq("id", message.id);
      }
      notifyUnreadMessagesChanged();
    }
  };

  const handleRealtimeMessage = (payload: any) => {
    if (!user) return;
    notifyIncoming(payload);

    if (payload.eventType === "UPDATE") {
      const row = payload.new as MessageRow;
      if (!row || !isRelevantMessage(row, user.id, threadsRef.current)) return;
      const threadId = getThreadIdForMessage(row, user.id);
      const active = Boolean(threadId && selectedIdRef.current === threadId);
      const nearBottom = shouldAutoScroll();
      updateThreadWithMessage(row, { forceRead: active });
      if (active && row.sender_id !== user.id && isUnread(row, user.id)) void markRealtimeMessageRead(row);
      if (active && nearBottom) window.setTimeout(scrollToBottom, 60);
      return;
    }

    if (payload.eventType !== "INSERT") {
      loadThreads({ silent: true });
      return;
    }

    const row = payload.new as MessageRow;
    if (!row || !isRelevantMessage(row, user.id, threadsRef.current)) return;
    const threadId = getThreadIdForMessage(row, user.id);
    const active = Boolean(threadId && selectedIdRef.current === threadId);
    const nearBottom = shouldAutoScroll();
    updateThreadWithMessage(row);
    if (active && row.sender_id !== user.id) void markRealtimeMessageRead(row);
    if (active && nearBottom) window.setTimeout(scrollToBottom, 60);

    if (!threadsRef.current.some((thread) => thread.id === threadId) && (row.request_id || !profilesRef.current.has(row.sender_id))) {
      loadThreads({ silent: true });
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
    unread.forEach((message) => saveLocalReadFallback(user.id, message.id));
    setThreads((current) => current.map((item) => item.id === thread.id ? {
      ...item,
      unreadCount: 0,
      messages: item.messages.map((message) => ({ ...message, read: true, read_by: Array.from(new Set([...(message.read_by ?? []), user.id])) })),
    } : item));
    notifyUnreadMessagesChanged();

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
    if (attachments.length) {
      showMessageSchemaError({ message: "attachment_names column is missing" });
      return;
    }
    const createdAt = new Date().toISOString();
    const tempMessage: MessageRow = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      recipient_id: selected.type === "direct" ? selected.recipientId : undefined,
      request_id: selected.type === "request" ? selected.requestId : undefined,
      message,
      created_at: createdAt,
      delivery_status: "sending",
      read_by: [user.id],
      reply_to_id: replyTo?.id.endsWith("-initial") ? null : replyTo?.id ?? null,
    };
    setText("");
    setSending(true);
    updateThreadWithMessage(tempMessage);
    window.localStorage.removeItem(`${draftPrefix}${selected.id}`);
    window.setTimeout(scrollToBottom, 40);
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
      setThreads((current) => current.map((thread) => thread.id === selected.id ? {
        ...thread,
        messages: thread.messages.map((item) => item.id === tempMessage.id ? { ...item, delivery_status: "failed" } : item),
      } : thread));
      return;
    }
    updateThreadWithMessage(result.data as MessageRow, { replaceTempId: tempMessage.id });
    clearAttachments();
    setReplyTo(null);
    if (!muted.has(selected.id)) {
      if (selected.type === "direct") {
        await insertNotification(directMessageNotification({
          userId: selected.recipientId,
          senderId: user.id,
          receiverId: selected.recipientId,
          senderName: profile?.full_name || profile?.username || user.email || "SyncUp user",
          senderAvatar: profile?.avatar_url ?? null,
          conversationId: selected.id,
          messageId: (result.data as MessageRow).id,
          messagePreview: message,
        }));
      } else {
        await insertNotification({
          user_id: selected.recipientId,
          title: "New request message",
          message: `${selected.title} has a new message.`,
          metadata: {
            type: "request_message",
            senderId: user.id,
            senderName: profile?.full_name || profile?.username || user.email || "SyncUp user",
            senderAvatar: profile?.avatar_url ?? null,
            conversationId: selected.id,
            messagePreview: message,
          },
        });
      }
    }
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
    setOpenMessageMenuId(null);
    const deletedFor = Array.from(new Set([...(message.deleted_for ?? []), user.id]));
    removeMessageFromThread(selected.id, message.id);
    const { error } = await (supabase as any).from(table).update({ deleted_for: deletedFor }).eq("id", message.id);
    if (error) {
      toast.error(error.message);
      await loadThreads({ silent: true });
      return;
    }
    toast.success("Message deleted for you.");
    await loadThreads({ silent: true });
  };

  const deleteMessageForEveryone = async (message: MessageRow) => {
    if (!user || !selected || message.sender_id !== user.id || message.id.endsWith("-initial")) return;
    const confirmed = window.confirm("Delete this message for everyone? Others will no longer be able to see it.");
    if (!confirmed) return;
    const table = selected.type === "direct" ? "direct_messages" : "join_request_messages";
    setOpenMessageMenuId(null);
    const deletedAt = new Date().toISOString();
    const deletedMessage = { ...message, message: "", deleted_for_everyone: true, deleted_at: deletedAt, deleted_by: user.id };
    updateThreadWithMessage(deletedMessage);
    const result = await updateMessageWithFallback(
      table,
      message.id,
      { message: "", deleted_for_everyone: true, deleted_at: deletedAt, deleted_by: user.id },
      { message: "", deleted_for_everyone: true },
    );
    const error = result.error;
    if (error) {
      toast.error(error.message);
      await loadThreads({ silent: true });
      return;
    }
    toast.success("Message deleted for everyone.");
    await loadThreads({ silent: true });
  };

  const deleteConversationForMe = async () => {
    if (!user || !selected) return;
    const confirmed = window.confirm("Clear this chat for you? Other people will still keep their messages.");
    if (!confirmed) return;

    const removableMessages = selected.messages.filter((message) => !message.id.endsWith("-initial"));
    saveLocalDeletedThread(user.id, selected.id, new Date().toISOString());
    setThreads((current) => current.filter((thread) => thread.id !== selected.id));
    setSelectedId((current) => current === selected.id ? null : current);
    setChatOpen(false);
    setReplyTo(null);
    setEditing(null);
    setText("");
    setOpenMessageMenuId(null);

    await Promise.all(removableMessages.map((message) => {
      const table = selected.type === "direct" ? "direct_messages" : "join_request_messages";
      const deletedFor = Array.from(new Set([...(message.deleted_for ?? []), user.id]));
      return (supabase as any).from(table).update({ deleted_for: deletedFor }).eq("id", message.id);
    }));

    toast.success("Chat cleared for you.");
    await loadThreads({ silent: true });
  };

  const removeMessageFromThread = (threadId: string, messageId: string) => {
    setThreads((current) => current.map((thread) => {
      if (thread.id !== threadId) return thread;
      const messages = thread.messages.filter((item) => item.id !== messageId);
      const last = messages[messages.length - 1];
      return {
        ...thread,
        messages,
        subtitle: last?.message || attachmentSubtitle(last) || "No messages yet",
        updatedAt: last?.created_at ?? thread.updatedAt,
        unreadCount: user ? messages.filter((item) => isUnread(item, user.id)).length : thread.unreadCount,
      };
    }).filter((thread) => thread.messages.length || thread.id !== threadId));
  };

  const decideRequest = async (status: "accepted" | "rejected") => {
    if (!user || !selected || selected.type !== "request" || !selected.requestId || selected.teamLeaderId !== user.id || selected.requestStatus !== "pending") return;

    try {
      if (status === "accepted" && selected.teamId && selected.requestUserId) {
        const { error: memberError } = await supabase.from("team_members").upsert({
          team_id: selected.teamId,
          user_id: selected.requestUserId,
          role: "member",
        } as never, { onConflict: "team_id,user_id" });
        if (memberError) throw memberError;
      }

      const { error } = await supabase.from("join_requests").update({ status }).eq("id", selected.requestId);
      if (error) throw error;

      if (selected.requestUserId) {
        await supabase.from("notifications").insert({
          user_id: selected.requestUserId,
          title: status === "accepted" ? "Join request accepted" : "Join request rejected",
          message: `${selected.teamName || selected.title} ${status === "accepted" ? "accepted" : "rejected"} your request.`,
        });
      }

      setThreads((current) => current.map((thread) => thread.id === selected.id ? { ...thread, requestStatus: status, subtitle: `${status} request` } : thread));
      toast.success(status === "accepted" ? "Request accepted." : "Request rejected.");
      await loadThreads({ silent: true });
      setSelectedId(selected.id);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not update request.");
    }
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
  const unreadTotal = getUnreadMessagesCount(threads);
  const filterCounts = {
    all: threads.length,
    direct: threads.filter((thread) => thread.type === "direct").length,
    requests: threads.filter((thread) => thread.type === "request").length,
    unread: unreadTotal,
  };
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.localStorage.setItem("syncup_mute_all_notifications", next ? "false" : "true");
    toast.success(next ? "Message sounds on." : "Message sounds off.");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const syncLayout = () => {
      setCompactChat(media.matches);
      if (!media.matches) setChatOpen(false);
    };
    syncLayout();
    media.addEventListener("change", syncLayout);
    return () => media.removeEventListener("change", syncLayout);
  }, []);

  return (
    <section className="mx-auto flex h-[calc(100svh-6.25rem)] w-full max-w-[1440px] min-w-0 flex-col gap-5 overflow-hidden md:min-h-[600px]">
      <div className="syncup-card shrink-0 rounded-3xl px-5 py-4 sm:px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-950 dark:text-slate-50">
              <MessageSquare className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              Messages
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Direct messages and team request conversations.</p>
          </div>
          <button
            onClick={toggleSound}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              soundEnabled ? "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-100" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            Sound {soundEnabled ? "on" : "off"}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 gap-5 overflow-hidden md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="syncup-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl">
          <div className="shrink-0 border-b border-slate-200 p-3 sm:p-4 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-cyan-600 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-cyan-300"
                placeholder="Search people, messages, teams, requests..."
              />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 text-[11px] font-semibold dark:border-white/10 dark:bg-white/5 sm:text-xs">
              {([
                ["all", "All"],
                ["direct", "Direct"],
                ["requests", "Requests"],
                ["unread", "Unread"],
              ] as Array<[InboxFilter, string]>).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-xl px-2 py-2 transition ${filter === key ? "bg-white text-slate-950 shadow-sm dark:bg-cyan-300 dark:text-[#0B0F19]" : "text-slate-600 hover:bg-white hover:text-slate-950 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"}`}
                >
                  {label}{key !== "unread" && filterCounts[key] ? ` ${filterCounts[key]}` : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="messages-scroll min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto p-3 sm:p-4">
            {loading ? (
              <ThreadSkeleton />
            ) : visibleThreads.length ? (
              visibleThreads.map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    active={selected?.id === thread.id}
                    typingNames={typingRows.filter((row) => row.thread_id === thread.id && row.user_id !== user?.id && +new Date(row.expires_at) > Date.now()).map((row) => profiles.get(row.user_id)?.full_name || "Someone")}
                    muted={muted.has(thread.id)}
                    onOpen={() => {
                      setSelectedId(thread.id);
                      if (compactChat) setChatOpen(true);
                    }}
                  />
                ))
            ) : (
              <EmptyInbox filter={filter} query={query} />
            )}
          </div>
        </aside>

        <section className="syncup-card hidden h-full min-h-0 min-w-0 overflow-hidden rounded-3xl md:flex">
          {selected ? (
            <Conversation
              selected={selected}
              userId={user?.id}
              profiles={profiles}
              query={query}
              muted={muted.has(selected.id)}
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
              onMute={() => toggleThreadSet(muteKey, selected.id, muted.has(selected.id) ? "Conversation unmuted." : "Conversation muted.")}
              onDeleteConversation={deleteConversationForMe}
              onAcceptRequest={() => decideRequest("accepted")}
              onRejectRequest={() => decideRequest("rejected")}
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
        <div className="message-mobile-sheet fixed inset-x-0 bottom-0 top-16 z-[45] overflow-hidden bg-white dark:bg-[#0B0F19] md:hidden">
          <Conversation
            selected={selected}
            userId={user?.id}
            profiles={profiles}
            query={query}
            muted={muted.has(selected.id)}
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
            onMute={() => toggleThreadSet(muteKey, selected.id, muted.has(selected.id) ? "Conversation unmuted." : "Conversation muted.")}
            onDeleteConversation={deleteConversationForMe}
            onAcceptRequest={() => decideRequest("accepted")}
            onRejectRequest={() => decideRequest("rejected")}
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
  query,
  muted,
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
  onMute,
  onDeleteConversation,
  onAcceptRequest,
  onRejectRequest,
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
  onMenu,
  onAttach,
  onRemoveAttachment,
  onDrag,
}: {
  selected: Thread;
  userId?: string;
  profiles: Map<string, Profile>;
  query: string;
  muted: boolean;
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
  onMute: () => void;
  onDeleteConversation: () => void;
  onAcceptRequest: () => void;
  onRejectRequest: () => void;
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
  onMenu: (id: string | null) => void;
  onAttach: (files: FileList | File[]) => void;
  onRemoveAttachment: (index: number) => void;
  onDrag: (value: boolean) => void;
}) {
  const otherProfile = selected.profileId ? profiles.get(selected.profileId) : undefined;
  const requestStatus = selected.requestStatus ?? "pending";
  const canDecideRequest = selected.type === "request" && requestStatus === "pending" && selected.teamLeaderId === userId;

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
        toast.info("Attachments are not enabled for this workspace yet.");
      }}
    >
      <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#101827] sm:gap-3 sm:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {onBack && (
            <button onClick={onBack} className="shrink-0 rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <AvatarButton thread={selected} profile={otherProfile} onOpen={onProfileOpen} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-base font-semibold text-slate-950 dark:text-white sm:text-lg">{selected.title}</h2>
              {selected.type === "request" && <StatusBadge status={requestStatus} />}
            </div>
            <p className="truncate text-xs text-slate-500 dark:text-white/45">
              {selected.type === "request"
                ? `${otherProfile?.full_name || otherProfile?.username || "Applicant"} - ${selected.teamName || "Team request"}`
                : otherProfile?.role || otherProfile?.college || "Direct message"}
            </p>
            {selected.type === "direct" && selectedTyping.length > 0 && (
              <span className="flex items-center gap-2 text-xs text-cyan-700 dark:text-cyan-200">
                {selectedTyping.join(", ")} {selectedTyping.length === 1 ? "is" : "are"} typing <TypingDots />
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5 sm:gap-2">
          <button onClick={onMute} className={`rounded-full border p-2 transition ${muted ? "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-300/30 dark:bg-cyan-300/15 dark:text-cyan-100" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"}`} title="Mute">
            <BellOff className="h-4 w-4" />
          </button>
          <button onClick={onDeleteConversation} className="rounded-full border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100 dark:hover:bg-red-500/15" title="Delete chat">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {selected.type === "request" && (
        <div className="shrink-0 border-b border-slate-200 bg-cyan-50/60 p-3 dark:border-white/10 dark:bg-cyan-300/5 sm:p-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-cyan-200 bg-white p-4 dark:border-cyan-300/15 dark:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-950 dark:text-white">Team join request</p>
                <StatusBadge status={requestStatus} />
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-white/55">
                {otherProfile?.full_name || otherProfile?.username || "Applicant"} requested to join {selected.teamName || selected.title}.
              </p>
              {selected.requestMessage && <p className="mt-2 line-clamp-2 text-sm text-slate-700 dark:text-white/65">"{selected.requestMessage}"</p>}
              {(selected.requestSkills ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.requestSkills?.slice(0, 5).map((skill) => (
                    <span key={skill} className="rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-300/15 dark:text-cyan-100">{skill}</span>
                  ))}
                </div>
              )}
            </div>
            {canDecideRequest && (
              <div className="flex shrink-0 gap-2">
                <button onClick={onRejectRequest} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100 dark:hover:bg-red-500/15">
                  Reject
                </button>
                <button onClick={onAcceptRequest} className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 dark:bg-cyan-300 dark:text-[#0B0F19] dark:hover:bg-cyan-200">
                  Accept
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} className="messages-scroll min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto bg-slate-50/70 p-3 dark:bg-[#0B0F19]/45 sm:p-4">
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
                onMenu={onMenu}
              />
            </div>
          );
        }) : <NoMessages />}
        {selectedTyping.length > 0 && <TypingIndicator names={selectedTyping} />}
      </div>

      {showJump && (
        <button onClick={onScrollBottom} className="absolute bottom-24 right-6 grid h-10 w-10 place-items-center rounded-full bg-cyan-700 text-white shadow-lg dark:bg-cyan-300 dark:text-[#0B0F19]">
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
  onMenu: (id: string | null) => void;
}) {
  const { message, own, grouped, profile, thread, query, reply, openMenu } = props;
  const deleted = Boolean(message.deleted_for_everyone);
  const sharedPost = parseSharedPostMessage(message.message);
  const actionButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!openMenu || typeof window === "undefined") return;

    const updateMenuPosition = () => {
      const rect = actionButtonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const menuWidth = 224;
      const menuHeight = own ? 218 : 150;
      const gutter = 12;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < menuHeight + gutter
        ? Math.max(gutter, rect.top - menuHeight - 8)
        : Math.min(window.innerHeight - menuHeight - gutter, rect.bottom + 8);
      const preferredLeft = own ? rect.right - menuWidth : rect.left;
      const left = Math.min(window.innerWidth - menuWidth - gutter, Math.max(gutter, preferredLeft));

      setMenuPosition({ top, left });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [openMenu, own]);

  const closeAfter = (action: () => void) => {
    action();
    props.onMenu(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`group flex gap-2 sm:gap-3 ${own ? "justify-end" : "justify-start"} ${grouped ? "mt-1" : "mt-2.5"}`}>
      {!own && !grouped ? (
        <button onClick={() => profile && props.onProfileOpen(profile)} className="mt-1 shrink-0">
          <SafeAvatar profile={profile ?? ({ full_name: thread.title, username: null } as Profile)} className="h-9 w-9 text-[11px]" />
        </button>
      ) : !own ? <span className="h-9 w-9 shrink-0" /> : null}
      <div className={`relative min-w-0 ${sharedPost ? "w-fit max-w-[85%] sm:max-w-[680px] lg:max-w-[70%]" : "max-w-[85%] sm:max-w-[70%]"} ${own ? "ml-auto" : "mr-auto"}`}>
        <div className={`relative rounded-2xl px-3 py-2 text-sm shadow-sm sm:px-4 sm:py-2.5 ${own ? "message-bubble-own bg-cyan-700 text-white dark:bg-cyan-300/20 dark:text-cyan-50" : "message-bubble-other border border-slate-200 bg-white text-slate-800 dark:border-transparent dark:bg-white/8 dark:text-white/75"} ${grouped ? own ? "rounded-tr-md" : "rounded-tl-md" : ""}`}>
          <button ref={actionButtonRef} onClick={() => props.onMenu(openMenu ? null : message.id)} className="message-action-button absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white/80 text-slate-500 opacity-100 transition hover:bg-slate-100 dark:border-white/10 dark:bg-transparent dark:text-white sm:opacity-0 sm:group-hover:opacity-100" title="Message actions">
            <MoreVertical className="h-4 w-4" />
          </button>
          {reply && (
            <button onClick={() => props.onScrollMessage(reply.id)} className="mb-2 block w-full rounded-lg border-l-2 border-cyan-500 bg-black/10 px-3 py-2 text-left text-xs text-slate-600 dark:border-cyan-300 dark:bg-black/15 dark:text-white/55">
              Replying to: {reply.message || attachmentSubtitle(reply)}
            </button>
          )}
          {deleted ? (
            <p className="italic opacity-65">This message was deleted</p>
          ) : sharedPost ? (
            <SharedPostPreview sharedPost={sharedPost} query={query} />
          ) : message.message && (
            <p className="whitespace-pre-wrap break-words pr-6 [overflow-wrap:anywhere] sm:pr-0">{highlight(message.message, query)}</p>
          )}
          {!deleted && <Attachments message={message} />}
          <div className={`mt-1.5 flex items-center gap-2 text-[10px] opacity-65 ${own ? "justify-end" : "justify-start"}`}>
            {message.edited_at && <span>edited</span>}
            <span>{smartTime(message.created_at)}</span>
            {own && <ReadReceipt message={message} />}
          </div>
        </div>
        {!deleted && openMenu && menuPosition && typeof document !== "undefined" && createPortal(
          <div className="message-action-menu fixed z-[9999] w-56 rounded-xl border border-white/10 bg-[#0B0F19]/95 p-2 shadow-2xl backdrop-blur-xl" style={{ top: menuPosition.top, left: menuPosition.left }}>
            <MenuButton icon={Reply} label="Reply" onClick={() => closeAfter(() => props.onReply(message))} />
            <MenuButton icon={Copy} label="Copy" onClick={() => closeAfter(() => props.onCopy(message))} />
            <MenuButton icon={Trash2} label="Delete for me" onClick={() => closeAfter(() => props.onDeleteMe(message))} />
            {own && (
              <>
                <MenuButton icon={Edit3} label="Edit" onClick={() => closeAfter(() => props.onEdit(message))} />
                <MenuButton icon={Trash2} label="Delete for everyone" danger onClick={() => closeAfter(() => props.onDeleteAll(message))} />
              </>
            )}
          </div>,
          document.body,
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
    <form onSubmit={onSubmit} className="message-composer shrink-0 border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#101827] sm:p-4">
      {(editing || replyTo) && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
          <span className="truncate text-slate-600 dark:text-white/60">{editing ? "Editing message" : `Replying to: ${replyTo?.message || attachmentSubtitle(replyTo)}`}</span>
          <button type="button" onClick={onCancel} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {attachments.map((item, index) => (
            <div key={`${item.file.name}-${index}`} className="relative shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
              {item.previewUrl && item.file.type.startsWith("image/") ? <img src={item.previewUrl} alt="" className="h-20 w-24 rounded-lg object-cover" /> : <FileText className="h-10 w-10 text-cyan-700 dark:text-cyan-300" />}
              <p className="mt-1 max-w-24 truncate text-[10px] text-slate-500 dark:text-white/55">{item.file.name}</p>
              <button type="button" onClick={() => onRemoveAttachment(index)} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex min-w-0 items-end gap-2 sm:gap-3">
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          rows={1}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-cyan-600 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-cyan-300 sm:min-h-12 sm:px-4 sm:py-3"
          placeholder="Write a message..."
        />
        <button disabled={sending || (!text.trim() && !attachments.length)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-700 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gradient-to-r dark:from-blue-500 dark:to-purple-500 sm:flex sm:h-12 sm:w-auto sm:gap-2 sm:px-5">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline">{editing ? "Save" : "Send"}</span>
        </button>
      </div>
    </form>
  );
}

function ThreadCard({ thread, active, typingNames, muted, onOpen }: { thread: Thread; active: boolean; typingNames: string[]; muted: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className={`w-full overflow-hidden rounded-2xl border p-3 text-left transition ${active ? "border-cyan-300 bg-cyan-50 shadow-sm dark:border-cyan-300/50 dark:bg-cyan-300/10" : thread.unreadCount ? "border-cyan-200 bg-cyan-50/50 dark:border-cyan-300/30 dark:bg-cyan-300/5" : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"}`}>
      <div className="flex items-center gap-3">
        <span className="relative h-10 w-10 shrink-0 sm:h-11 sm:w-11">
          <SafeAvatar
            user={{ avatarUrl: thread.avatarUrl, full_name: thread.title }}
            fallbackIcon={!thread.profileId ? <Users className="h-4 w-4" /> : undefined}
            className="h-full w-full text-sm"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-slate-950 dark:text-white">{thread.title}</span>
            {thread.unreadCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cyan-700 px-1 text-[10px] font-bold text-white dark:bg-cyan-300 dark:text-[#0B0F19]">{thread.unreadCount}</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-white/8 dark:text-white/45">
              {thread.type === "direct" ? "Direct" : "Team request"}
            </span>
            {thread.type === "request" && thread.requestStatus && <StatusBadge status={thread.requestStatus} />}
          </span>
          <span className={`block truncate text-xs ${typingNames.length ? "text-cyan-700 dark:text-cyan-200" : "text-slate-500 dark:text-white/50"}`}>
            {typingNames.length ? `${typingNames.slice(0, 2).join(", ")} typing...` : thread.subtitle}
          </span>
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-white/35">
        <span>{smartDateTime(thread.updatedAt)}</span>
        {muted && <BellOff className="h-3.5 w-3.5" />}
      </div>
    </button>
  );
}

function AvatarButton({ thread, profile, onOpen }: { thread: Thread; profile?: Profile; onOpen: (profile: Profile) => void }) {
  return (
    <button onClick={() => profile && onOpen(profile)} className="shrink-0">
      <SafeAvatar
        user={{ avatarUrl: thread.avatarUrl, full_name: thread.title }}
        fallbackIcon={!thread.profileId ? <Users className="h-5 w-5" /> : undefined}
        className="h-10 w-10 text-sm sm:h-12 sm:w-12 sm:text-base"
      />
    </button>
  );
}

function ProfileDrawer({ profile, threads, onClose }: { profile: Profile; threads: Thread[]; onClose: () => void }) {
  const sharedThreads = threads.filter((thread) => thread.profileId === profile.id);
  return (
    <motion.aside initial={{ x: 380 }} animate={{ x: 0 }} className="message-profile-drawer fixed bottom-0 right-0 top-0 z-[100] w-full max-w-sm border-l border-slate-200 bg-white p-5 text-slate-950 shadow-2xl dark:border-white/10 dark:bg-[#0B0F19] dark:text-white">
      <div className="flex justify-end">
        <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>
      <div className="text-center">
        <SafeAvatar profile={profile} className="mx-auto h-24 w-24 text-2xl" />
        <h2 className="mt-4 text-2xl font-bold">{profile.full_name || profile.username || "SyncUp user"}</h2>
        <p className="text-sm text-cyan-200">@{profile.username || "profile"}</p>
      </div>
      <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:bg-white/5 dark:text-white/60">{profile.bio || "No bio added yet."}</p>
      <div className="mt-5">
        <p className="text-xs font-semibold text-white/45">Skills</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(profile.skills ?? []).length ? profile.skills?.map((skill) => <span key={skill} className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs text-cyan-100">{skill}</span>) : <span className="text-sm text-white/45">No skills listed.</span>}
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="text-sm font-semibold">Recent activity</p>
        <p className="mt-2 text-sm text-white/55">{sharedThreads.reduce((sum, thread) => sum + thread.messages.length, 0)} messages in this inbox.</p>
      </div>
      <Link to="/profiles/$id" params={{ id: profile.id }} className="mt-5 flex justify-center rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white dark:bg-cyan-300 dark:text-[#0B0F19]">
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
          <a key={url} href={url} download className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs hover:bg-slate-100 dark:border-white/10 dark:bg-black/15 dark:hover:bg-white/10">
            {type === "application/pdf" ? <FileText className="h-4 w-4 text-red-200" /> : <Download className="h-4 w-4 text-cyan-200" />}
            <span className="truncate">{name}</span>
          </a>
        );
      })}
    </div>
  );
}

function SharedPostPreview({ sharedPost, query }: { sharedPost: SharedPostMessage; query: string }) {
  return (
    <div className="space-y-3 pr-6 sm:pr-0">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan-700 dark:text-cyan-100/70">Shared a SyncUp post</p>
        <p className="text-sm font-semibold text-slate-800 dark:text-white/85">from {sharedPost.author}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 shadow-inner dark:border-white/10 dark:bg-black/15 dark:text-white/80 sm:p-4">
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{highlight(sharedPost.content, query)}</p>
      </div>
    </div>
  );
}

function ReadReceipt({ message }: { message: MessageRow }) {
  if (message.delivery_status === "failed") return <span className="text-red-200" title="Failed to send">Failed</span>;
  if (message.delivery_status === "sending") return <span title="Sending">Sending</span>;
  const readCount = (message.read_by ?? []).filter((id) => id !== message.sender_id).length;
  if (readCount > 0 || message.read) return <span title={`${readCount || 1} read`}><CheckCheck className="h-3.5 w-3.5 text-cyan-200" /></span>;
  if (!message.id.startsWith("temp-")) return <span title="Delivered"><CheckCheck className="h-3.5 w-3.5 opacity-60" /></span>;
  return <span title="Sent"><Check className="h-3.5 w-3.5 opacity-60" /></span>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className = normalized === "accepted"
    ? "bg-emerald-400/15 text-emerald-100"
    : normalized === "rejected"
      ? "bg-red-400/15 text-red-100"
      : "bg-yellow-300/15 text-yellow-100";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`}>{status}</span>;
}

function TypingIndicator({ names }: { names: string[] }) {
  return <div className="ml-10 flex items-center gap-2 text-sm text-cyan-200">{names.join(", ")} typing <TypingDots /></div>;
}

function TypingDots() {
  return <span className="inline-flex gap-1"><span className="animate-bounce">●</span><span className="animate-bounce [animation-delay:120ms]">●</span><span className="animate-bounce [animation-delay:240ms]">●</span></span>;
}

function DateSeparator({ label }: { label: string }) {
  return <div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /><span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm dark:bg-white/5 dark:text-white/45">{label}</span><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>;
}

function NoChatSelected() {
  return (
    <div className="grid w-full place-items-center p-10 text-center">
      <div className="grid h-24 w-24 place-items-center rounded-full bg-cyan-50 dark:bg-cyan-300/10">
        <MessageSquare className="h-10 w-10 text-cyan-700 dark:text-cyan-200" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-slate-950 dark:text-white">Select a conversation to start messaging.</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-white/50">Choose a profile chat or team request thread from your inbox.</p>
      <Link to="/discover" className="mt-5 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-semibold text-white dark:bg-cyan-300 dark:text-[#0B0F19]">Find builders</Link>
    </div>
  );
}

function NoMessages() {
  return <div className="grid h-full place-items-center rounded-2xl bg-white p-8 text-center text-sm text-slate-500 dark:bg-white/5 dark:text-white/45">No messages yet. Start the conversation.</div>;
}

function EmptyInbox({ filter = "all", query = "" }: { filter?: InboxFilter; query?: string }) {
  const copy = query.trim()
    ? "No matching conversations."
    : filter === "unread"
      ? "No unread messages."
      : filter === "requests"
        ? "No team request conversations yet."
        : filter === "direct"
          ? "No direct messages yet."
          : "No conversations yet. Open a profile and send a message.";
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-white/5 dark:text-white/55">{copy}</div>;
}

function ThreadSkeleton() {
  return <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />)}</div>;
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

function getThreadIdForMessage(message: MessageRow, userId: string) {
  if (message.request_id) return `request-${message.request_id}`;
  const otherId = message.sender_id === userId ? message.recipient_id : message.sender_id;
  return otherId ? `direct-${otherId}` : "";
}

function directProfileIdFromThreadId(conversationId?: string | null) {
  if (!conversationId?.startsWith("direct-")) return null;
  return conversationId.slice("direct-".length);
}

function mergeOptimisticThreads(current: Thread[], incoming: Thread[]) {
  const next = incoming.map((thread) => {
    const currentThread = current.find((item) => item.id === thread.id);
    const optimisticMessages = (currentThread?.messages ?? []).filter((message) => message.id.startsWith("temp-"));
    if (!optimisticMessages.length) return thread;

    const messages = optimisticMessages.reduce((merged, optimistic) => {
      const alreadyResolved = merged.some((message) => isMatchingTempMessage(optimistic, message));
      return alreadyResolved ? merged : mergeThreadMessages(merged, optimistic);
    }, thread.messages);
    const last = messages[messages.length - 1];

    return {
      ...thread,
      messages,
      subtitle: last?.message || attachmentSubtitle(last) || thread.subtitle,
      updatedAt: last?.created_at ?? thread.updatedAt,
    };
  });

  const nextIds = new Set(next.map((thread) => thread.id));
  const optimisticOnlyThreads = current.filter((thread) => !nextIds.has(thread.id) && thread.messages.some((message) => message.id.startsWith("temp-")));
  return [...next, ...optimisticOnlyThreads].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

function isRelevantMessage(message: MessageRow, userId: string, threads: Thread[]) {
  if (message.request_id) {
    return threads.some((thread) => thread.id === `request-${message.request_id}`);
  }
  return message.sender_id === userId || message.recipient_id === userId;
}

function mergeThreadMessages(messages: MessageRow[], incoming: MessageRow, replaceTempId?: string) {
  const next = messages
    .filter((message) => message.id !== incoming.id)
    .filter((message) => !replaceTempId || message.id !== replaceTempId)
    .filter((message) => !isMatchingTempMessage(message, incoming));
  return [...next, incoming].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
}

function isMatchingTempMessage(temp: MessageRow, incoming: MessageRow) {
  if (!temp.id.startsWith("temp-") || incoming.id.startsWith("temp-")) return false;
  if (temp.sender_id !== incoming.sender_id || temp.message !== incoming.message) return false;
  if ((temp.recipient_id ?? "") !== (incoming.recipient_id ?? "")) return false;
  if ((temp.request_id ?? "") !== (incoming.request_id ?? "")) return false;
  return Math.abs(+new Date(temp.created_at) - +new Date(incoming.created_at)) < 30000;
}

function isVisibleFor(userId: string) {
  return (message: MessageRow) => !(message.deleted_for ?? []).includes(userId);
}

function isUnread(message: MessageRow, userId: string) {
  return isUnreadMessage(message, userId);
}

function parseSharedPostMessage(value?: string | null): SharedPostMessage | null {
  if (!value) return null;
  const match = value.match(/^Shared a SyncUp post from ([^:\n]+):\s*\n+([\s\S]+)$/i);
  if (!match) return null;
  const author = match[1]?.trim();
  const content = match[2]?.trim();
  if (!author || !content) return null;
  return { author, content };
}

function normalizeReactions(value: MessageRow["reactions"]) {
  if (!value || Array.isArray(value) || typeof value !== "object") return {} as Record<string, string[]>;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, users]) => Array.isArray(users))
      .map(([reaction, users]) => [reaction, [...new Set(users as string[])]])
      .filter(([, users]) => users.length),
  ) as Record<string, string[]>;
}

function toggleUserReaction(current: Record<string, string[]>, userId: string, reaction: string) {
  const hadReaction = (current[reaction] ?? []).includes(userId);
  const next = Object.fromEntries(
    Object.entries(current)
      .map(([emoji, users]) => [emoji, users.filter((id) => id !== userId)])
      .filter(([, users]) => users.length),
  ) as Record<string, string[]>;

  if (!hadReaction) {
    next[reaction] = [...new Set([...(next[reaction] ?? []), userId])];
  }

  return next;
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
  if (Object.keys(normalizeReactions(reactionsValue)).length) current[messageId] = reactionsValue;
  else delete current[messageId];
  window.localStorage.setItem(`syncup_local_reactions_${userId}`, JSON.stringify(current));
}

function applyLocalReactionFallback(message: MessageRow, fallback: Record<string, Record<string, string[]>>) {
  return fallback[message.id] ? { ...message, reactions: fallback[message.id] } : message;
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
  notifyUnreadMessagesChanged();
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
