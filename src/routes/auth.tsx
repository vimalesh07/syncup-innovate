import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/auth")({
  component: AuthRedirect,
});

function AuthRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/signup", replace: true });
  }, [navigate]);

  return (
    <main className="syncup-app grid min-h-screen place-items-center text-white">
      <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
    </main>
  );
}
