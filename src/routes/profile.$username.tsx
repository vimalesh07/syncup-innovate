import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "./profile";

export const Route = createFileRoute("/profile/$username")({
  head: () => ({ meta: [{ title: "Profile | SyncUp" }] }),
  component: ProfileUsernameRoute,
});

function ProfileUsernameRoute() {
  const { username } = Route.useParams();
  return <ProfilePage routeUsername={username} />;
}
