import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { GradientBlobs, FloatingParticles } from "@/components/landing/Background";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · SyncUp" },
      { name: "description", content: "Join SyncUp to find your dream innovation team." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect signed-in users
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <main className="relative min-h-screen bg-[#0B0F19] text-white flex items-center justify-center px-4 py-12 overflow-hidden">
      <div className="absolute inset-0 grid-bg" />
      <GradientBlobs />
      <FloatingParticles count={25} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-400 flex items-center justify-center glow-blue">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold">Sync<span className="text-gradient">Up</span></span>
        </Link>

        <div className="glass-strong rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-center">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-white/60 text-center mt-1">
            {mode === "signin" ? "Sign in to find your team." : "Join 12,000+ student innovators."}
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#fff" d="M21.35 11.1h-9.17v2.96h5.25c-.22 1.43-1.66 4.2-5.25 4.2-3.16 0-5.74-2.62-5.74-5.85s2.58-5.85 5.74-5.85c1.8 0 3 .77 3.7 1.43l2.52-2.43C16.96 3.86 14.85 3 12.18 3 7.04 3 2.88 7.16 2.88 12.3s4.16 9.3 9.3 9.3c5.37 0 8.93-3.77 8.93-9.07 0-.6-.07-1.06-.16-1.43Z" /></svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-white/40">
            <div className="flex-1 h-px bg-white/10" />or<div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-xs text-white/60">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="mt-1 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-blue-400 transition"
                  placeholder="Ananya Sharma"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-white/60">Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-white/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-blue-400 transition"
                  placeholder="you@college.edu"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/60">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-white/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-blue-400 transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:shadow-[0_0_40px_rgba(99,102,241,0.7)] transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>{mode === "signin" ? "Sign in" : "Create account"} <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-white/60 mt-6">
            {mode === "signin" ? "New to SyncUp?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
