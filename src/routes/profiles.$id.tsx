import { createFileRoute } from "@tanstack/react-router";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { ProfilePage } from "./profile";

export const Route = createFileRoute("/profiles/$id")({
  head: () => ({ meta: [{ title: "Profile | SyncUp" }] }),
  component: ProfileDetailRoute,
});

function ProfileDetailRoute() {
  const { id } = Route.useParams();

  return (
    <ProtectedPage>
      <PlatformShell>
        <ProfilePage routeUsername={id} />
      </PlatformShell>
    </ProtectedPage>
  );
}
