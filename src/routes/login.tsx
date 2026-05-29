import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthFrame } from "@/components/app/AuthFrame";
import { SocialAuthButtons } from "@/components/app/SocialAuthButtons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login | SyncUp" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authHelp, setAuthHelp] = useState(false);

  const getSavedRoute = () => {
    if (typeof window === "undefined") return "/dashboard";
    const saved = window.localStorage.getItem("syncup_last_route");
    if (!saved || saved === "/" || saved.startsWith("/login") || saved.startsWith("/signup") || saved.startsWith("/forgot-password") || saved.startsWith("/reset-password")) {
      return "/dashboard";
    }
    return saved;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ href: getSavedRoute(), replace: true });
    });
  }, [navigate]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) throw error;
      if (!remember) {
        window.sessionStorage.setItem("syncup_session_mode", "session");
      }
      toast.success("Welcome back.");
      navigate({ href: getSavedRoute(), replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed.";
      const invalidCredentials = /invalid login credentials/i.test(message);
      setAuthHelp(invalidCredentials);
      toast.error(
        invalidCredentials
            ? "We could not sign you in. Check the password, reset it, or create the account again."
            : message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="Welcome back" subtitle="Enter your command center and keep building with your team.">
      <div className="mt-6">
        <SocialAuthButtons mode="login" />
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-white/40">
        <div className="h-px flex-1 bg-white/10" />or continue with email<div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={login} className="space-y-4">
        {authHelp ? (
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-50">
            <p className="font-semibold">Can not sign in yet</p>
            <p className="mt-1 text-cyan-50/70">
              Supabase rejected this email and password. Check the password, reset it, or create a new account.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/forgot-password"
                search={{ email }}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
              >
                Reset password
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
              >
                Create account
              </Link>
            </div>
          </div>
        ) : null}

        <div>
          <label className="text-xs text-white/60">Email</label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-3.5 h-4 w-4 text-white/40" />
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setAuthHelp(false);
              }}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pl-10 text-sm outline-none transition focus:border-cyan-300"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/60">Password</label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-3.5 h-4 w-4 text-white/40" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pl-10 pr-11 text-sm outline-none transition focus:border-cyan-300"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-3.5 text-white/50 transition hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 text-white/60">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5"
            />
            Remember me
          </label>
          <Link to="/forgot-password" search={{ email: "" }} className="text-cyan-300 hover:text-cyan-200">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-5 py-3.5 font-semibold shadow-[0_0_40px_rgba(99,102,241,0.35)] transition hover:shadow-[0_0_60px_rgba(99,102,241,0.65)] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Login <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/60">
        New to SyncUp? <Link to="/signup" className="font-semibold text-cyan-300">Create an account</Link>
      </p>
    </AuthFrame>
  );
}
