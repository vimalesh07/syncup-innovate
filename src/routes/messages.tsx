import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader2, MessageSquare, MoreVertical, Send, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  created_at: string;
  deleted_for?: string[] | null;
  deleted_for_everyone?: boolean | null;
};

type RequestMessage = {
  id: string;
  request_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  deleted_for?: string[] | null;
  deleted_for_everyone?: boolean | null;
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

type Thread = {
  id: string;
  type: "direct" | "request";
  title: string;
  subtitle: string;
  avatarUrl?: string | null;
  profileId?: string;
  teamId?: string;
  requestId?: string;
  recipientId?: string;
  updatedAt: string;
  messages: Array<{ id: string; sender_id: string; message: string; created_at: string; deleted_for?: string[] | null; deleted_for_everyone?: boolean | null }>;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);

  const selected = useMemo(() => threads.find((thread) => thread.id === selectedId) ?? threads[0], [threads, selectedId]);

  const loadThreads = async () => {
    if (!user) return;
    setLoading(true);
    const directProfileId =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("direct") : null;

    const directResult = await (supabase as any)
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: true });
    if (directResult.error) {
      toast.error(directResult.error.message);
      setLoading(false);
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
    const teamMap = new Map(((teamsResult.data as Team[]) ?? leaderTeams).map((team) => [team.id, team]));

    const directRows = ((directResult.data as DirectMessage[]) ?? []).filter((message) => !message.deleted_for_everyone && !(message.deleted_for ?? []).includes(user.id));
    const otherProfileIds = new Set<string>();
    directRows.forEach((message) => otherProfileIds.add(message.sender_id === user.id ? message.recipient_id : message.sender_id));
    if (directProfileId && directProfileId !== user.id) otherProfileIds.add(directProfileId);
    requests.forEach((request) => {
      const team = teamMap.get(request.team_id);
      otherProfileIds.add(request.user_id);
      if (team?.leader_id) otherProfileIds.add(team.leader_id);
    });

    const profilesResult = otherProfileIds.size
      ? await supabase.from("profiles").select("*").in("id", [...otherProfileIds])
      : { data: [] };
    const profileMap = new Map(((profilesResult.data as Profile[]) ?? []).map((profile) => [profile.id, profile]));

    const directThreads = [...groupBy(directRows, (message) => (message.sender_id === user.id ? message.recipient_id : message.sender_id)).entries()].map(([otherId, messages]) => {
      const profile = profileMap.get(otherId);
      const last = messages[messages.length - 1];
      return {
        id: `direct-${otherId}`,
        type: "direct" as const,
        title: profile?.full_name || profile?.username || "SyncUp user",
        subtitle: last?.message || "Direct message",
        avatarUrl: profile?.avatar_url,
        profileId: otherId,
        recipientId: otherId,
        updatedAt: last?.created_at ?? new Date().toISOString(),
        messages,
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
      });
    }

    const requestMessageMap = groupBy(
      ((requestMessagesResult.data as RequestMessage[]) ?? []).filter((message) => !message.deleted_for_everyone && !(message.deleted_for ?? []).includes(user.id)),
      (message) => message.request_id,
    );
    const requestThreads = requests.map((request) => {
      const team = teamMap.get(request.team_id);
      const otherId = request.user_id === user.id ? team?.leader_id : request.user_id;
      const profile = otherId ? profileMap.get(otherId) : null;
      const messages = requestMessageMap.get(request.id) ?? [];
      const visibleMessages = request.message
        ? [{ id: `${request.id}-initial`, sender_id: request.user_id, message: request.message, created_at: request.created_at }, ...messages]
        : messages;
      const last = visibleMessages[visibleMessages.length - 1];
      return {
        id: `request-${request.id}`,
        type: "request" as const,
        title: team?.team_name || "Team request",
        subtitle: `${request.status} request${profile ? ` with ${profile.full_name || profile.username || "SyncUp user"}` : ""}`,
        avatarUrl: profile?.avatar_url,
        profileId: otherId,
        teamId: request.team_id,
        requestId: request.id,
        recipientId: otherId,
        updatedAt: last?.created_at ?? request.created_at,
        messages: visibleMessages,
      };
    });

    const nextThreads = [...directThreads, ...requestThreads].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    setThreads(nextThreads);
    setSelectedId((current) => {
      if (directProfileId && directProfileId !== user.id) return `direct-${directProfileId}`;
      return current ?? nextThreads[0]?.id ?? null;
    });
    setLoading(false);
  };

  useEffect(() => {
    loadThreads();
  }, [user?.id]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selected || !text.trim() || !selected.recipientId) return;

    const message = text.trim();
    setText("");
    setSending(true);

    const result = selected.type === "direct"
      ? await (supabase as any).from("direct_messages").insert({ sender_id: user.id, recipient_id: selected.recipientId, message }).select("*").single()
      : await (supabase as any).from("join_request_messages").insert({ request_id: selected.requestId, sender_id: user.id, message }).select("*").single();

    setSending(false);
    if (result.error) {
      toast.error(result.error.message);
      setText(message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: selected.recipientId,
      title: selected.type === "direct" ? "New direct message" : "New request message",
      message: selected.type === "direct" ? "You received a profile message." : `${selected.title} has a new message.`,
    });

    await loadThreads();
    setSelectedId(selected.id);
  };

  const deleteMessageForMe = async (message: Thread["messages"][number]) => {
    if (!user || !selected || message.id.endsWith("-initial")) return;
    const table = selected.type === "direct" ? "direct_messages" : "join_request_messages";
    const deletedFor = Array.from(new Set([...(message.deleted_for ?? []), user.id]));
    const { error } = await (supabase as any).from(table).update({ deleted_for: deletedFor }).eq("id", message.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpenMessageMenuId(null);
    await loadThreads();
    setSelectedId(selected.id);
  };

  const deleteMessageForEveryone = async (message: Thread["messages"][number]) => {
    if (!user || !selected || message.sender_id !== user.id || message.id.endsWith("-initial")) return;
    const table = selected.type === "direct" ? "direct_messages" : "join_request_messages";
    const { error } = await (supabase as any).from(table).update({ deleted_for_everyone: true }).eq("id", message.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpenMessageMenuId(null);
    await loadThreads();
    setSelectedId(selected.id);
  };

  return (
    <section className="space-y-6">
      <div className="glass-strong neon-border rounded-2xl p-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <MessageSquare className="h-7 w-7 text-cyan-300" />
          Messages
        </h1>
        <p className="mt-2 text-white/55">Manage profile chats and team request conversations in one focused inbox.</p>
      </div>

      <div className="grid min-h-[620px] min-w-0 gap-6 lg:grid-cols-[0.38fr_0.62fr]">
        <aside className="glass-strong min-w-0 rounded-2xl p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Inbox</h2>
            <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs text-cyan-100">{threads.length}</span>
          </div>
          {loading ? (
            <div className="grid h-52 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-300" /></div>
          ) : threads.length ? (
            <div className="space-y-2">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => {
                    setSelectedId(thread.id);
                    setChatOpen(true);
                  }}
                  className={`w-full cursor-pointer overflow-hidden rounded-2xl border p-4 text-left transition ${
                    selected?.id === thread.id ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {thread.profileId ? (
                      <Link
                        to="/profiles/$id"
                        params={{ id: thread.profileId }}
                        onClick={(event) => event.stopPropagation()}
                        className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-sm font-bold ring-1 ring-white/10 transition hover:scale-105"
                        title="Open profile"
                      >
                        {thread.avatarUrl ? <img src={thread.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials({ full_name: thread.title, username: null } as Profile)}
                      </Link>
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-sm font-bold ring-1 ring-white/10">
                        <Users className="h-4 w-4" />
                      </span>
                    )}
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(thread.id);
                        setChatOpen(true);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-semibold">{thread.title}</p>
                      <p className="truncate text-xs text-white/50">{thread.subtitle}</p>
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-white/35">{new Date(thread.updatedAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-white/55">
              No conversations yet. Open a profile and send a message.
            </div>
          )}
        </aside>

        <section className="glass-strong hidden min-w-0 rounded-2xl p-4 xl:flex">
          {selected ? (
            <div className="flex min-h-0 w-full flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  {selected.profileId ? (
                    <Link
                      to="/profiles/$id"
                      params={{ id: selected.profileId }}
                      className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 font-bold ring-1 ring-white/10 transition hover:scale-105"
                      title="Open profile"
                    >
                      {selected.avatarUrl ? <img src={selected.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials({ full_name: selected.title, username: null } as Profile)}
                    </Link>
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 font-bold ring-1 ring-white/10">
                      <Users className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold">{selected.title}</h2>
                    <p className="truncate text-sm text-white/50">{selected.subtitle}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selected.profileId && <Link to="/profiles/$id" params={{ id: selected.profileId }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">Profile</Link>}
                  {selected.teamId && <Link to="/teams/$id" params={{ id: selected.teamId }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">Team</Link>}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-5">
                {selected.messages.length ? selected.messages.map((message) => {
                  const own = message.sender_id === user?.id;
                  return (
                    <motion.div key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}>
                      {!own && selected.profileId && (
                        <Link
                          to="/profiles/$id"
                          params={{ id: selected.profileId }}
                          className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-[11px] font-bold ring-1 ring-white/10 transition hover:scale-105"
                          title="Open profile"
                        >
                          {selected.avatarUrl ? <img src={selected.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials({ full_name: selected.title, username: null } as Profile)}
                        </Link>
                      )}
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${own ? "bg-cyan-300/20 text-cyan-50" : "bg-white/8 text-white/75"}`}>
                        <p>{message.message}</p>
                        <p className="mt-1 text-[10px] text-white/35">{new Date(message.created_at).toLocaleString()}</p>
                      </div>
                    </motion.div>
                  );
                }) : (
                  <div className="grid h-full place-items-center rounded-2xl bg-white/5 p-8 text-center text-sm text-white/45">
                    No messages yet. Start the conversation.
                  </div>
                )}
              </div>

              <form onSubmit={sendMessage} className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row">
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
                  placeholder="Write a message..."
                />
                <button disabled={sending || !text.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold disabled:opacity-60">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </button>
              </form>
            </div>
          ) : (
            <div className="grid w-full place-items-center rounded-2xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white/55">
              Select a conversation to view messages.
            </div>
          )}
        </section>
      </div>

      {chatOpen && selected && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/65 px-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="glass-strong neon-border flex h-[82vh] w-full max-w-3xl flex-col rounded-2xl p-4"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex min-w-0 items-center gap-3">
                {selected.profileId ? (
                  <Link
                    to="/profiles/$id"
                    params={{ id: selected.profileId }}
                    className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 font-bold ring-1 ring-white/10 transition hover:scale-105"
                    title="Open profile"
                  >
                    {selected.avatarUrl ? <img src={selected.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials({ full_name: selected.title, username: null } as Profile)}
                  </Link>
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 font-bold ring-1 ring-white/10">
                    <Users className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold">{selected.title}</h2>
                  <p className="truncate text-sm text-white/50">{selected.subtitle}</p>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} className="rounded-xl p-2 text-white/60 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-5">
              {selected.messages.length ? selected.messages.map((message) => {
                const own = message.sender_id === user?.id;
                return (
                  <motion.div key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}>
                    {!own && selected.profileId && (
                      <Link
                        to="/profiles/$id"
                        params={{ id: selected.profileId }}
                        className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-[11px] font-bold ring-1 ring-white/10 transition hover:scale-105"
                        title="Open profile"
                      >
                        {selected.avatarUrl ? <img src={selected.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials({ full_name: selected.title, username: null } as Profile)}
                      </Link>
                    )}
                    <div className="relative">
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 pr-10 text-sm ${own ? "bg-cyan-300/20 text-cyan-50" : "bg-white/8 text-white/75"}`}>
                      <p>{message.message}</p>
                      <p className="mt-1 text-[10px] text-white/35">{new Date(message.created_at).toLocaleString()}</p>
                    </div>
                    {!message.id.endsWith("-initial") && (
                      <button onClick={() => setOpenMessageMenuId(openMessageMenuId === message.id ? null : message.id)} className="absolute right-2 top-2 rounded-lg p-1 text-white/50 hover:bg-white/10">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    )}
                    {openMessageMenuId === message.id && (
                      <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-white/10 bg-[#101827] p-2 shadow-2xl">
                        <button onClick={() => deleteMessageForMe(message)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-white/75 hover:bg-white/10">
                          Delete for me
                        </button>
                        {own && (
                          <button onClick={() => deleteMessageForEveryone(message)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-red-200 hover:bg-red-500/10">
                            Delete for everyone
                          </button>
                        )}
                      </div>
                    )}
                    </div>
                  </motion.div>
                );
              }) : (
                <div className="grid h-full place-items-center rounded-2xl bg-white/5 p-8 text-center text-sm text-white/45">
                  No messages yet. Start the conversation.
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row">
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
                placeholder="Write a message..."
              />
              <button disabled={sending || !text.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold disabled:opacity-60">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </section>
  );
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
