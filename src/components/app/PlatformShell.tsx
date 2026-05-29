import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Bell,
  Bookmark,
  Search,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  Sparkles,
  Sun,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { initials, profileCompletion } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { CursorGlow, FloatingParticles, GradientBlobs } from "@/components/landing/Background";

const productLinks = [
  { label: "Home", to: "/dashboard", icon: LayoutDashboard },
  { label: "Discover", to: "/discover", icon: Search },
  { label: "Messages", to: "/messages", icon: MessageSquare },
  { label: "Profile", to: "/profile", icon: User },
  { label: "My Teams", to: "/my-teams", icon: Users },
  { label: "Saved", to: "/saved-competitions", icon: Bookmark },
  { label: "Settings", to: "/settings", icon: Settings },
];

type Notification = {
  id: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
};

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const { profile, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("syncup_theme") === "dark" ? "dark" : "light";
  });
  const navigate = useNavigate();
  const completion = profileCompletion(profile);
  const unreadCount = notifications.filter((item) => !item.read).length;

  const loadNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);
    setNotifications((data as Notification[]) ?? []);
  };

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  useEffect(() => {
    window.localStorage.setItem("syncup_theme", theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.body.dataset.theme = theme;
  }, [theme]);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out securely.");
    navigate({ to: "/" });
  };

  const openNotifications = async () => {
    setNotificationOpen((current) => !current);
    if (!notificationOpen) {
      await loadNotifications();
      if (unreadCount > 0 && user) {
        await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
        setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      }
    }
  };

  return (
    <main className={`syncup-app relative min-h-screen overflow-hidden text-white ${theme === "light" ? "theme-light" : "theme-dark"}`}>
      <CursorGlow />
      <div className="absolute inset-0 grid-bg" />
      <GradientBlobs />
      <FloatingParticles count={18} />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0B0F19]/65 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-400 glow-blue">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">Sync<span className="text-gradient">Up</span></span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {productLinks.filter((link) => link.label !== "Profile" && link.label !== "Settings").map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="theme-control hidden rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 md:block"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={openNotifications}
              className="relative hidden rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 md:block"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-cyan-300 px-1 text-[10px] font-bold text-[#0B0F19] shadow-[0_0_12px_rgba(34,211,238,0.9)]">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-1.5 pr-3 transition hover:bg-white/10"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-xl object-cover" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 text-sm font-bold">
                  {initials(profile, user?.email)}
                </span>
              )}
              <span className="hidden text-left md:block">
                <span className="block text-sm font-semibold">{profile?.username || user?.email}</span>
                <span className="block text-[11px] text-white/45">{completion}% profile strength</span>
              </span>
              <Menu className="h-4 w-4 text-white/60 md:hidden" />
            </button>
          </div>
        </div>
      </header>

      {notificationOpen && (
        <motion.aside
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed right-4 top-20 z-50 w-[calc(100%-2rem)] max-w-md rounded-2xl glass-strong p-3 shadow-2xl md:right-40"
        >
          <div className="flex items-center justify-between px-2 py-2">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-white/50">Join requests and team updates</p>
            </div>
            <button onClick={() => setNotificationOpen(false)} className="rounded-lg p-2 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="my-2 h-px bg-white/10" />
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {notifications.length ? notifications.map((item) => (
              <Link
                key={item.id}
                to="/my-teams"
                onClick={() => setNotificationOpen(false)}
                className="block rounded-xl bg-white/5 p-3 transition hover:bg-white/10"
              >
                <p className="text-sm font-semibold">{item.title}</p>
                {item.message && <p className="mt-1 text-xs text-white/55">{item.message}</p>}
                <p className="mt-2 text-[11px] text-white/35">{new Date(item.created_at).toLocaleString()}</p>
              </Link>
            )) : (
              <p className="rounded-xl bg-white/5 p-4 text-center text-sm text-white/50">No notifications yet.</p>
            )}
          </div>
        </motion.aside>
      )}

      {open && (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed right-4 top-20 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl glass-strong p-3 shadow-2xl md:right-8"
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
          {productLinks.map((link) => {
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
      )}

      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6">{children}</section>
    </main>
  );
}
