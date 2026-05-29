import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function completeAuth() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const next = url.searchParams.get("next") || "/dashboard";

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!data.session) {
          throw new Error("Auth link did not create a session. Try signing in again.");
        }

        window.localStorage.removeItem("syncup_pending_verification_email");
        if (active) navigate({ to: next as "/dashboard", replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not finish sign in.";
        toast.error(message);
        if (active) navigate({ to: "/login", replace: true });
      }
    }

    completeAuth();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="syncup-app grid min-h-screen place-items-center text-white">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
        <p className="mt-3 text-sm text-white/60">Finishing sign in...</p>
      </div>
    </main>
  );
}
