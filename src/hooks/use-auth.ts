import { useEffect, useState } from "react";
import type { AuthState } from "@/lib/auth";
import { getCurrentAuthState, getOrCreateProfile } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    getCurrentAuthState().then((next) => {
      if (mounted) setState(next);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setState({ session: null, user: null, profile: null, loading: false });
        return;
      }

      setState((current) => ({
        ...current,
        session,
        user: session.user,
        loading: true,
      }));

      setTimeout(async () => {
        const profile = await getOrCreateProfile(session.user);
        if (mounted) {
          setState({ session, user: session.user, profile, loading: false });
        }
      }, 0);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
