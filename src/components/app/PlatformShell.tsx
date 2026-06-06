import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Bell,
  ShieldCheck,
  Search,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  Sun,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileCompletion } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { BrandLogo } from "@/components/app/BrandLogo";
import { SafeAvatar } from "@/components/app/SafeAvatar";
import { CursorGlow, FloatingParticles, GradientBlobs } from "@/components/landing/Background";

const productLinks = [
  { label: "Home", to: "/dashboard", icon: LayoutDashboard },
  { label: "Discover", to: "/discover", icon: Search },
  { label: "Messages", to: "/messages", icon: MessageSquare },
  { label: "Profile", to: "/profile", icon: User },
  { label: "My Teams", to: "/my-teams", icon: Users },
  { label: "Guidelines", to: "/community-guidelines", icon: ShieldCheck },
  { label: "Settings", to: "/settings", icon: Settings },
];

const primaryNavLinks = productLinks.filter((link) => link.label !== "Profile" && link.label !== "Settings");

type Notification = {
  id: string;
  type?: string | null;
  title: string;
  message: string | null;
  target_path?: string | null;
  targetPath?: string | null;
  senderId?: string;
  sender_id?: string;
  actorId?: string;
  actor_id?: string;
  conversationId?: string;
  conversation_id?: string;
  messagePreview?: string;
  message_preview?: string;
  content?: string | null;
  senderAvatar?: string | null;
  sender_avatar?: string | null;
  actorName?: string | null;
  actorAvatar?: string | null;
  actor_avatar?: string | null;
  metadata?: NotificationMetadata | null;
  read: boolean;
  created_at: string;
};

type NotificationMetadata = {
  type?: string;
  senderId?: string;
  sender_id?: string;
  actorId?: string;
  actor_id?: string;
  senderName?: string;
  sender_name?: string;
  senderAvatar?: string | null;
  sender_avatar?: string | null;
  actorName?: string;
  actor_name?: string;
  actorAvatar?: string | null;
  actor_avatar?: string | null;
  conversationId?: string;
  conversation_id?: string;
  messagePreview?: string;
  message_preview?: string;
  targetPath?: string;
  target_path?: string;
};

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const { profile, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [cookieNoticeOpen, setCookieNoticeOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("syncup_cookie_notice") !== "accepted";
  });
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("syncup_theme") === "dark" ? "dark" : "light";
  });
  const navigate = useNavigate();
  const location = useLocation();
  const completion = profileCompletion(profile);
  const notificationUnreadCount = notifications.filter((item) => !item.read).length;
  const locationKey = `${location.pathname}${location.searchStr}${location.hash}`;
  const isMessagesPage = location.pathname.startsWith("/messages");
  const metadataUsername = typeof user?.user_metadata?.username === "string" ? user.user_metadata.username : "";
  const metadataName = typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : "";
  const profileUsername = (profile?.username || metadataUsername || metadataName || user?.email?.split("@")[0] || user?.id || "profile").replace(/^@/, "");

  const loadNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);
    const rows = (data as Notification[]) ?? [];
    const senderIds = [...new Set(rows.map(getNotificationSenderId).filter(Boolean))] as string[];

    if (!senderIds.length) {
      setNotifications(rows);
      return;
    }

    const profilesResult = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", senderIds);
    const profileMap = new Map(((profilesResult.data as Array<{ id: string; full_name: string | null; username: string | null; avatar_url: string | null }>) ?? []).map((item) => [item.id, item]));

    setNotifications(rows.map((row) => {
      const senderId = getNotificationSenderId(row);
      const senderProfile = senderId ? profileMap.get(senderId) : null;
      if (!senderProfile) return row;
      const metadata = normalizeNotificationMetadata(row.metadata);
      return {
        ...row,
        metadata: {
          ...metadata,
          senderId: metadata.senderId || metadata.sender_id || senderId,
          senderName: metadata.senderName || metadata.sender_name || senderProfile.full_name || senderProfile.username || cleanDirectMessageTitle(row.title),
          senderAvatar: metadata.senderAvatar || metadata.sender_avatar || senderProfile.avatar_url,
        },
      };
    }));
  };

  const loadMessageUnreadCount = async () => {
    if (!user) return;
    const localReads = readLocalMessageReads(user.id);
    let directRows = await (supabase as any)
      .from("direct_messages")
      .select("id, sender_id, recipient_id, read, read_by, deleted_for_everyone, deleted_at, created_at")
      .eq("recipient_id", user.id);
    if (directRows.error && isMissingMessageMetadata(directRows.error)) {
      directRows = await (supabase as any)
        .from("direct_messages")
        .select("id, sender_id, recipient_id, read, created_at")
        .eq("recipient_id", user.id);
    }

    let count = countUnreadLatestThreads(
      ((directRows.data as UnreadBadgeMessage[]) ?? []),
      user.id,
      localReads,
      (message) => `direct-${message.sender_id === user.id ? message.recipient_id : message.sender_id}`,
    );

    const leaderTeams = await supabase.from("teams").select("id").eq("leader_id", user.id);
    const leaderTeamIds = ((leaderTeams.data as Array<{ id: string }>) ?? []).map((team) => team.id);
    const ownRequests = await supabase.from("join_requests").select("id").eq("user_id", user.id);
    const leaderRequests = leaderTeamIds.length ? await supabase.from("join_requests").select("id").in("team_id", leaderTeamIds) : { data: [] };
    const requestIds = [
      ...new Set([
        ...(((ownRequests.data as Array<{ id: string }>) ?? []).map((request) => request.id)),
        ...(((leaderRequests.data as Array<{ id: string }>) ?? []).map((request) => request.id)),
      ]),
    ];

    if (requestIds.length) {
      let requestMessages = await (supabase as any)
        .from("join_request_messages")
        .select("id, request_id, sender_id, read_by, deleted_for_everyone, deleted_at, created_at")
        .in("request_id", requestIds);
      if (requestMessages.error && isMissingMessageMetadata(requestMessages.error)) {
        requestMessages = await (supabase as any)
          .from("join_request_messages")
          .select("id, request_id, sender_id, created_at")
          .in("request_id", requestIds);
      }
      count += countUnreadLatestThreads(
        ((requestMessages.data as UnreadBadgeMessage[]) ?? []),
        user.id,
        localReads,
        (message) => `request-${message.request_id ?? message.id}`,
      );
    }

    setMessageUnreadCount(count);
  };

  useEffect(() => {
    loadNotifications();
    loadMessageUnreadCount();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    window.addEventListener("syncup_message_reads_updated", loadMessageUnreadCount);
    return () => window.removeEventListener("syncup_message_reads_updated", loadMessageUnreadCount);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`shell-unread-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => loadMessageUnreadCount())
      .on("postgres_changes", { event: "*", schema: "public", table: "join_request_messages" }, () => loadMessageUnreadCount())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => loadNotifications())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    window.localStorage.setItem("syncup_theme", theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    window.localStorage.setItem("syncup_last_route", locationKey);

    const scrollKey = `syncup_scroll:${locationKey}`;
    const savedY = Number(window.sessionStorage.getItem(scrollKey) ?? 0);
    if (savedY > 0) {
      window.setTimeout(() => window.scrollTo({ top: savedY, behavior: "instant" }), 80);
    }

    const saveScroll = () => {
      window.sessionStorage.setItem(scrollKey, String(window.scrollY));
    };

    window.addEventListener("beforeunload", saveScroll);
    window.addEventListener("pagehide", saveScroll);
    return () => {
      saveScroll();
      window.removeEventListener("beforeunload", saveScroll);
      window.removeEventListener("pagehide", saveScroll);
    };
  }, [locationKey, user]);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out securely.");
    navigate({ to: "/" });
  };

  const openNotifications = async () => {
    setNotificationOpen((current) => !current);
    if (!notificationOpen) {
      await loadNotifications();
      if (notificationUnreadCount > 0 && user) {
        await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
        setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      }
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    const content = getNotificationContent(notification);
    setNotificationOpen(false);

    if (!notification.read) {
      setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)));
      await supabase.from("notifications").update({ read: true }).eq("id", notification.id);
    }

    navigateToNotificationTarget(content.targetPath, navigate);
  };

  const acceptCookieNotice = () => {
    window.localStorage.setItem("syncup_cookie_notice", "accepted");
    setCookieNoticeOpen(false);
  };

  return (
    <main className={`syncup-app relative min-h-screen overflow-x-hidden text-white ${theme === "light" ? "theme-light" : "theme-dark"}`}>
      <div className="pointer-events-none absolute inset-0 hidden opacity-30 dark:block">
        <CursorGlow />
        <div className="absolute inset-0 grid-bg" />
        <GradientBlobs />
        <FloatingParticles count={10} />
      </div>

      <header className="sticky inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 text-slate-900 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-50">
        <div className="mx-auto flex h-[76px] max-w-[1280px] items-center gap-4 px-4 sm:px-6">
          <Link to="/dashboard" className="flex h-full shrink-0 items-center">
            <BrandLogo />
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-2 lg:flex">
            {primaryNavLinks.map((link) => {
              const Icon = link.icon;
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative flex h-11 min-w-[104px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                    active
                      ? "bg-slate-100 text-slate-950 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-cyan-700 dark:text-cyan-300" : ""}`} />
                  <span>{link.label}</span>
                  {active && <span className="absolute inset-x-4 -bottom-[17px] h-0.5 rounded-full bg-cyan-700 dark:bg-cyan-300" />}
                  {link.to === "/messages" && messageUnreadCount > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cyan-700 px-1 text-[10px] font-bold text-white dark:bg-cyan-300 dark:text-slate-950">
                      {messageUnreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex h-full shrink-0 items-center justify-end gap-2 sm:gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="theme-control grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={openNotifications}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <Bell className="h-5 w-5" />
              {notificationUnreadCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-cyan-700 px-1 text-[10px] font-bold text-white dark:bg-cyan-300 dark:text-slate-950">
                  {notificationUnreadCount}
                </span>
              )}
            </button>
            <Link
              to="/profile/$username"
              params={{ username: profileUsername }}
              className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 pr-2 text-slate-900 transition hover:bg-slate-100 sm:pr-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              <SafeAvatar profile={profile} fallback={user?.email} className="h-8 w-8 bg-cyan-700 text-sm dark:bg-cyan-300 dark:text-slate-950" />
              <span className="hidden max-w-[150px] text-left xl:block">
                <span className="block truncate text-sm font-semibold leading-4">{profile?.username || user?.email}</span>
                <span className="block truncate text-[11px] leading-4 text-slate-500 dark:text-slate-400">{completion}% profile strength</span>
              </span>
            </Link>
            <button
              onClick={() => setOpen((current) => !current)}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 lg:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
              title="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {notificationOpen && (
        <>
          <button className="fixed inset-0 z-40 bg-black/20 md:hidden" aria-label="Close notifications" onClick={() => setNotificationOpen(false)} />
          <motion.aside
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="platform-popover fixed right-4 top-20 z-50 w-[calc(100%-2rem)] max-w-md rounded-2xl p-3 shadow-2xl md:right-40"
          >
            <div className="flex items-center justify-between px-2 py-2">
              <div>
                <p className="text-sm font-semibold">Notifications</p>
                <p className="text-xs text-white/50">Messages, requests, and team updates</p>
              </div>
              <button onClick={() => setNotificationOpen(false)} className="rounded-lg p-2 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="my-2 h-px bg-white/10" />
            <div className="max-h-80 overflow-y-auto">
              {notifications.length ? notifications.map((item) => (
                <NotificationItem key={item.id} item={item} onOpen={() => handleNotificationClick(item)} />
              )) : (
                <p className="px-3 py-8 text-center text-sm text-white/50">No notifications yet.</p>
              )}
            </div>
          </motion.aside>
        </>
      )}

      {open && (
        <>
          <button className="fixed inset-0 z-40 bg-black/20 md:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />
          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            className="platform-popover fixed right-4 top-20 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl p-3 shadow-2xl md:right-8"
          >
            <div className="flex items-center justify-between px-2 py-2">
              <div>
                <p className="text-sm font-semibold">{profile?.full_name || profile?.username || "SyncUp user"}</p>
                <p className="text-xs text-white/50">{user?.email}</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="my-2 h-px bg-white/10" />
            {primaryNavLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  <Icon className="h-4 w-4 text-cyan-300" />
                  {link.label}
                  {link.to === "/messages" && messageUnreadCount > 0 && (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-cyan-300 px-1 text-[10px] font-bold text-[#0B0F19]">
                      {messageUnreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
            <button
              onClick={logout}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-200 transition hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </motion.aside>
        </>
      )}

      {cookieNoticeOpen && (
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-3xl rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl ${
            theme === "light"
              ? "border-cyan-300/45 bg-white/95 text-[#0B0F19]"
              : "border-cyan-300/25 bg-[#0B0F19]/90 text-white"
          }`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${theme === "light" ? "bg-cyan-100 text-cyan-700" : "bg-cyan-300/15 text-cyan-100"}`}>
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">Your data stays protected</p>
                <p className={`mt-1 text-sm leading-6 ${theme === "light" ? "text-slate-600" : "text-white/60"}`}>
                  SyncUp uses essential cookies/local storage for login sessions, theme, safety settings, and app preferences.
                </p>
                <Link
                  to="/community-guidelines"
                  className={`mt-2 inline-flex text-sm font-semibold ${theme === "light" ? "text-cyan-700 hover:text-cyan-600" : "text-cyan-200 hover:text-cyan-100"}`}
                >
                  Read community guidelines
                </Link>
              </div>
            </div>
            <button onClick={acceptCookieNotice} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#0B0F19]">
              Got it
            </button>
          </div>
        </motion.aside>
      )}

      <section className={`relative z-10 ${
        isMessagesPage
          ? "w-full px-4 pb-4 pt-3 sm:px-5 lg:px-6"
          : "mx-auto max-w-[1200px] px-4 pb-16 pt-5 sm:px-6"
      }`}>{children}</section>
    </main>
  );
}

function NotificationItem({ item, onOpen }: { item: Notification; onOpen: () => void }) {
  const content = getNotificationContent(item);
  const metadata = normalizeNotificationMetadata(item.metadata);
  const title = content.actorName;
  const preview = content.preview;
  const unread = !item.read;

  if (content.isDirectMessage) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-start gap-3 border-b border-white/10 px-3 py-3 text-left transition last:border-b-0 hover:bg-white/[0.06]"
      >
        <SafeAvatar
          user={{ avatarUrl: content.actorAvatar, full_name: title }}
          fallback={title}
          className="h-10 w-10 shrink-0 text-sm"
        />
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{title}</span>
            <span className="shrink-0 text-[11px] text-white/35">{shortTime(item.created_at)}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-cyan-100/80">{content.actionText}</span>
          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-white/55">{preview || "Open the conversation to read it."}</span>
        </span>
        {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-start gap-3 border-b border-white/10 px-3 py-3 text-left transition last:border-b-0 hover:bg-white/[0.06]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-cyan-100 ring-1 ring-cyan-300/15">
        <Bell className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">{title}</span>
          <span className="shrink-0 text-[11px] text-white/35">{shortTime(item.created_at)}</span>
        </span>
        {preview && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-white/55">{preview}</span>}
      </span>
      {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />}
    </button>
  );
}

function getNotificationContent(notification: Notification) {
  const metadata = normalizeNotificationMetadata(notification.metadata);
  const senderId =
    notification.senderId ||
    notification.sender_id ||
    notification.actorId ||
    notification.actor_id ||
    metadata.senderId ||
    metadata.sender_id ||
    metadata.actorId ||
    metadata.actor_id ||
    directProfileIdFromThreadId(notification.conversationId || notification.conversation_id || metadata.conversationId || metadata.conversation_id);
  const directTitle = notification.title.toLowerCase().includes("direct message") || notification.title.toLowerCase().includes("sent you a message");
  const isDirectMessage = notification.type === "direct_message" || metadata.type === "direct_message" || directTitle;

  if (isDirectMessage) {
    const conversationId = notification.conversationId || notification.conversation_id || metadata.conversationId || metadata.conversation_id;
    const resolvedConversationId = senderId && conversationId?.startsWith("direct-") && conversationId !== `direct-${senderId}`
      ? `direct-${senderId}`
      : conversationId;
    const storedTargetPath = notification.targetPath || notification.target_path || metadata.targetPath || metadata.target_path || "/messages";
    const targetPath = resolvedConversationId ? `/messages/${encodeURIComponent(resolvedConversationId)}` : senderId ? `/messages/direct-${encodeURIComponent(senderId)}` : storedTargetPath;

    return {
      actorName: getNotificationActorName(notification, metadata),
      actorAvatar: getNotificationActorAvatar(notification, metadata),
      actionText: "sent you a message",
      preview:
        metadata.messagePreview ||
        metadata.message_preview ||
        notification.messagePreview ||
        notification.message_preview ||
        notification.content ||
        notification.message ||
        "Open message",
      targetPath: normalizeMessageTargetPath(targetPath, senderId),
      isDirectMessage: true,
    };
  }

  return {
    actorName: cleanNotificationTitle(notification.title),
    actorAvatar: getNotificationActorAvatar(notification, metadata),
    actionText: "",
    preview: notification.message,
    targetPath: notification.targetPath || notification.target_path || metadata.targetPath || metadata.target_path || "/my-teams",
    isDirectMessage: false,
  };
}

function getNotificationSenderId(notification: Notification) {
  const metadata = normalizeNotificationMetadata(notification.metadata);
  return (
    notification.senderId ||
    notification.sender_id ||
    notification.actorId ||
    notification.actor_id ||
    metadata.senderId ||
    metadata.sender_id ||
    metadata.actorId ||
    metadata.actor_id ||
    directProfileIdFromThreadId(notification.conversationId || notification.conversation_id || metadata.conversationId || metadata.conversation_id) ||
    ""
  );
}

function getNotificationActorName(notification: Notification, metadata: NotificationMetadata) {
  return (
    metadata.senderName ||
    metadata.sender_name ||
    metadata.actorName ||
    metadata.actor_name ||
    notification.actorName ||
    cleanDirectMessageTitle(notification.title)
  );
}

function getNotificationActorAvatar(notification: Notification, metadata: NotificationMetadata) {
  return (
    metadata.senderAvatar ||
    metadata.sender_avatar ||
    metadata.actorAvatar ||
    metadata.actor_avatar ||
    notification.senderAvatar ||
    notification.sender_avatar ||
    notification.actorAvatar ||
    notification.actor_avatar ||
    ""
  );
}

function navigateToNotificationTarget(targetPath: string, navigate: ReturnType<typeof useNavigate>) {
  const [pathname, query = ""] = targetPath.split("?");
  const searchParams = new URLSearchParams(query);

  if (pathname === "/messages") {
    const direct = searchParams.get("direct") || searchParams.get("user");
    navigate(direct ? { to: "/messages", search: { direct } as never } : { to: "/messages" });
    return;
  }

  if (pathname.startsWith("/messages/")) {
    const conversationId = decodeURIComponent(pathname.slice("/messages/".length));
    navigate({ to: "/messages/$conversationId", params: { conversationId } });
    return;
  }

  if (pathname === "/dashboard") {
    navigate({ to: "/dashboard" });
    return;
  }

  if (pathname === "/discover") {
    navigate({ to: "/discover" });
    return;
  }

  if (pathname === "/my-teams") {
    navigate({ to: "/my-teams" });
    return;
  }

  if (pathname === "/profile") {
    navigate({ to: "/profile" });
    return;
  }

  if (pathname === "/community-guidelines") {
    navigate({ to: "/community-guidelines" });
    return;
  }

  navigate({ to: "/messages" });
}

function normalizeMessageTargetPath(targetPath: string, senderId?: string) {
  if (!targetPath || targetPath === "/my-teams") {
    return senderId ? `/messages/direct-${encodeURIComponent(senderId)}` : "/messages";
  }

  const [pathname, query = ""] = targetPath.split("?");
  if (pathname.startsWith("/messages/")) return pathname;
  if (pathname !== "/messages") return senderId ? `/messages?direct=${encodeURIComponent(senderId)}` : "/messages";

  const searchParams = new URLSearchParams(query);
  const direct = searchParams.get("direct") || searchParams.get("user");
  return direct ? `/messages/direct-${encodeURIComponent(direct)}` : senderId ? `/messages/direct-${encodeURIComponent(senderId)}` : "/messages";
}

function directProfileIdFromThreadId(conversationId?: string) {
  if (!conversationId?.startsWith("direct-")) return "";
  return conversationId.slice("direct-".length);
}

function cleanDirectMessageTitle(title: string) {
  const cleaned = title.replace(/\s+sent you a message$/i, "").trim();
  if (cleaned && !cleaned.toLowerCase().includes("new direct message")) return cleaned;
  return "Message";
}

function normalizeNotificationMetadata(value: unknown): NotificationMetadata {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value as NotificationMetadata;
}

function cleanNotificationTitle(title: string) {
  if (title.toLowerCase().includes("new direct message")) return "Message";
  if (title.toLowerCase().includes("new profile message")) return "Message";
  return title;
}

function shortTime(value: string) {
  const then = new Date(value).getTime();
  const diff = Date.now() - then;
  if (!Number.isFinite(then) || diff < 0) return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type UnreadBadgeMessage = {
  id: string;
  sender_id: string;
  recipient_id?: string | null;
  request_id?: string | null;
  read?: boolean | null;
  read_by?: string[] | null;
  deleted_for_everyone?: boolean | null;
  deleted_at?: string | null;
  created_at?: string | null;
};

function countUnreadLatestThreads(
  rows: UnreadBadgeMessage[],
  userId: string,
  localReads: Set<string>,
  getThreadKey: (message: UnreadBadgeMessage) => string,
) {
  const latestByThread = new Map<string, UnreadBadgeMessage>();

  rows
    .filter((message) => !message.deleted_for_everyone && !message.deleted_at)
    .forEach((message) => {
      const key = getThreadKey(message);
      if (!key || key.endsWith("undefined") || key.endsWith("null")) return;
      const current = latestByThread.get(key);
      if (!current || timestampValue(message.created_at) >= timestampValue(current.created_at)) {
        latestByThread.set(key, message);
      }
    });

  return [...latestByThread.values()].filter((message) => {
    if (message.sender_id === userId) return false;
    if (localReads.has(message.id)) return false;
    if ((message.read_by ?? []).includes(userId)) return false;
    return !message.read;
  }).length;
}

function timestampValue(value?: string | null) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function readLocalMessageReads(userId: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem(`syncup_local_reads_${userId}`) ?? "[]"));
  } catch {
    return new Set<string>();
  }
}

function isMissingMessageMetadata(error: { message?: string }) {
  const message = error.message ?? "";
  return message.includes("schema cache") || message.includes("Could not find");
}
