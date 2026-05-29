import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Lock, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      window.localStorage.setItem("syncup_last_route", `${location.pathname}${location.searchStr}${location.hash}`);
      const timer = window.setTimeout(() => navigate({ to: "/login" }), 900);
      return () => window.clearTimeout(timer);
    }
  }, [loading, location.hash, location.pathname, location.searchStr, navigate, user]);

  if (loading) {
    return (
      <div className="syncup-app grid min-h-screen place-items-center text-white">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="syncup-app grid min-h-screen place-items-center px-4 text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="glass-strong neon-border max-w-md rounded-2xl p-8 text-center"
        >
          <Lock className="mx-auto h-10 w-10 text-cyan-300" />
          <h1 className="mt-4 text-2xl font-bold">Access denied</h1>
          <p className="mt-2 text-sm text-white/60">
            Sign in to unlock your SyncUp dashboard, profile, teams, and saved competitions.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold"
          >
            Continue to login
          </Link>
        </motion.div>
      </main>
    );
  }

  return <>{children}</>;
}
