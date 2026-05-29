import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuthFrame } from "@/components/app/AuthFrame";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set New Password | SyncUp" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[0-9]/.test(password)) score += 25;
    if (/[^A-Za-z0-9]/.test(password)) score += 25;
    return score;
  }, [password]);

  useEffect(() => {
    let active = true;

    async function prepareRecoverySession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState({}, document.title, "/reset-password");
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          throw new Error("This reset link is expired or invalid. Request a new one.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not open reset link.");
        navigate({ to: "/forgot-password", search: { email: "" }, replace: true });
      } finally {
        if (active) setChecking(false);
      }
    }

    prepareRecoverySession();

    return () => {
      active = false;
    };
  }, [navigate]);

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (strength < 50) {
      toast.error("Use a stronger password before saving.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated. Please log in.");
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <AuthFrame title="Set a new password" subtitle="Choose a new password for your SyncUp account.">
      {checking ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
        </div>
      ) : (
        <form onSubmit={updatePassword} className="mt-6 space-y-4">
          <PasswordField
            label="New Password"
            value={password}
            showPassword={showPassword}
            onToggleVisibility={() => setShowPassword((current) => !current)}
            onChange={setPassword}
          />
          <div className="h-1.5 rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-400 via-yellow-300 to-emerald-300 transition-all"
              style={{ width: `${strength}%` }}
            />
          </div>
          <PasswordField
            label="Confirm Password"
            value={confirmPassword}
            showPassword={showPassword}
            onToggleVisibility={() => setShowPassword((current) => !current)}
            onChange={setConfirmPassword}
          />

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-5 py-3.5 font-semibold shadow-[0_0_40px_rgba(99,102,241,0.35)] transition hover:shadow-[0_0_60px_rgba(99,102,241,0.65)] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Save Password <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-white/60">
        Remembered it? <Link to="/login" className="font-semibold text-cyan-300">Back to login</Link>
      </p>
    </AuthFrame>
  );
}

function PasswordField({
  label,
  value,
  showPassword,
  onToggleVisibility,
  onChange,
}: {
  label: string;
  value: string;
  showPassword: boolean;
  onToggleVisibility: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-white/60">{label}</label>
      <div className="relative mt-1">
        <Lock className="absolute left-3 top-3.5 h-4 w-4 text-white/40" />
        <input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pl-10 pr-11 text-sm outline-none transition focus:border-cyan-300"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 top-3.5 text-white/50 transition hover:text-white"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
