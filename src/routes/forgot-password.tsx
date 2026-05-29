import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthFrame } from "@/components/app/AuthFrame";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
  }),
  head: () => ({ meta: [{ title: "Reset Password | SyncUp" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email);
  const [loading, setLoading] = useState(false);

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      toast.error(
        /rate limit/i.test(error.message)
          ? "Supabase email limit reached. Wait a few minutes before requesting another email."
          : error.message,
      );
      return;
    }
    toast.success("Password reset link sent. Check your inbox.");
  };

  return (
    <AuthFrame title="Reset your password" subtitle="We will send a secure recovery link to your email.">
      <form onSubmit={resetPassword} className="mt-6 space-y-4">
        <div>
          <label className="text-xs text-white/60">Email</label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-3.5 h-4 w-4 text-white/40" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pl-10 text-sm outline-none transition focus:border-cyan-300"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3.5 font-semibold disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          Send reset link
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-white/60">
        Remembered it? <Link to="/login" className="font-semibold text-cyan-300">Back to login</Link>
      </p>
    </AuthFrame>
  );
}
