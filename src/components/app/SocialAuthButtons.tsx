import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme: "outline" | "filled_blue" | "filled_black";
              size: "large" | "medium" | "small";
              type: "standard" | "icon";
              shape: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
            },
          ) => void;
        };
      };
    };
  }
}

export function SocialAuthButtons({ mode = "login" }: { mode?: "login" | "signup" }) {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        toast.error("Google did not return a sign-in token.");
        return;
      }

      setLoading(true);
      try {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
        });
        if (error) throw error;
        toast.success("Signed in with Google.");
        navigate({ to: "/dashboard" });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      } finally {
        setLoading(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const buttonTarget = googleButtonRef.current;
    if (!buttonTarget) return;

    if (!clientId) {
      toast.error("Missing VITE_GOOGLE_CLIENT_ID in .env");
      return;
    }

    const renderGoogleButton = () => {
      if (!window.google || !buttonTarget) return;
      buttonTarget.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(buttonTarget, {
        theme: "outline",
        size: "large",
        type: "standard",
        shape: "rectangular",
        width: 336,
        text: mode === "signup" ? "signup_with" : "continue_with",
      });
    };

    if (window.google) {
      renderGoogleButton();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existingScript) {
      existingScript.addEventListener("load", renderGoogleButton, { once: true });
      return () => existingScript.removeEventListener("load", renderGoogleButton);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    script.onerror = () => toast.error("Could not load Google Sign-In.");
    document.head.appendChild(script);
  }, [handleGoogleCredential, mode]);

  return (
    <div>
      <div className="flex min-h-[44px] w-full justify-center overflow-hidden rounded-md bg-white">
        <div ref={googleButtonRef} className={loading ? "pointer-events-none opacity-60" : ""} />
      </div>
    </div>
  );
}
