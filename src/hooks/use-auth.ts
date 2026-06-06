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

      let shouldLoadProfile = true;

      setState((current) => {
        const sameUser = current.user?.id === session.user.id;
        const hasProfile = Boolean(current.profile);
        shouldLoadProfile = !sameUser || !hasProfile;

        return {
          ...current,
          session,
          user: session.user,
          loading: shouldLoadProfile,
        };
      });

      if (!shouldLoadProfile) return;

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

  // Re-fetch profile when a profile update is dispatched elsewhere in the app
  useEffect(() => {
    let mounted = true;
    const handler = async () => {
      const next = await getCurrentAuthState();
      if (mounted) setState(next);
    };
    window.addEventListener("profile_updated", handler);
    return () => {
      mounted = false;
      window.removeEventListener("profile_updated", handler);
    };
  }, []);

  return state;
}
