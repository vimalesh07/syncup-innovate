import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bell, Bookmark, LayoutDashboard, LogOut, Menu, Moon, Settings, Sun, User, Users, X } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/app/BrandLogo";
import { SafeAvatar } from "@/components/app/SafeAvatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("syncup_theme") === "dark" ? "dark" : "light";
  });
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("syncup_theme", theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.body.dataset.theme = theme;
  }, [theme]);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out securely.");
    setProfileOpen(false);
    navigate({ to: "/" });
  };

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6`}>
        <div
          className={`flex items-center justify-between rounded-2xl px-4 sm:px-6 transition-all duration-300 ${
            scrolled ? "glass-strong py-2.5" : "py-3"
          }`}
        >
          <Link to="/" className="group flex items-center">
            <BrandLogo variant="light" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {user && (
              <Link to="/dashboard" className="text-sm text-white/70 hover:text-white transition-colors relative group">
                Dashboard
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-gradient-to-r from-blue-400 to-purple-400 group-hover:w-full transition-all duration-300" />
              </Link>
            )}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="theme-control rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {!loading && user ? (
              <div className="relative flex items-center gap-3">
                <button className="relative rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                </button>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-1.5 pr-3 transition hover:bg-white/10"
                >
                  <SafeAvatar profile={profile} fallback={user.email} className="h-9 w-9 text-sm" />
                  <span className="text-sm font-semibold">{profile?.username || user.email}</span>
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-14 w-64 rounded-2xl glass-strong p-3 shadow-2xl">
                    <MenuLink to="/profile" icon={User} label="My Profile" />
                    <MenuLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                    <MenuLink to="/my-teams" icon={Users} label="My Teams" />
                    <MenuLink to="/saved-competitions" icon={Bookmark} label="Saved Competitions" />
                    <MenuLink to="/settings" icon={Settings} label="Settings" />
                    <button onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-200 hover:bg-red-500/10">
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-white/80 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="relative text-sm font-medium px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 text-white"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden mt-2 glass-strong rounded-2xl p-4 flex flex-col gap-2"
          >
            {user ? (
              <>
                <Link to="/dashboard" className="text-sm text-white/80 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5">Dashboard</Link>
                <Link to="/profile" className="text-sm text-white/80 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5">My Profile</Link>
                <button onClick={logout} className="text-left text-sm text-red-200 px-3 py-2 rounded-lg hover:bg-red-500/10">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-center text-sm font-medium px-4 py-2.5 rounded-xl glass-strong text-white mt-2">Login</Link>
                <Link
                  to="/signup"
                  className="text-center text-sm font-medium px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                >
                  Get Started
                </Link>
              </>
            )}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="theme-control mt-2 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
}

function MenuLink({ to, icon: Icon, label }: { to: "/profile" | "/dashboard" | "/my-teams" | "/saved-competitions" | "/settings"; icon: typeof User; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
      <Icon className="h-4 w-4 text-cyan-300" />
      {label}
    </Link>
  );
}
