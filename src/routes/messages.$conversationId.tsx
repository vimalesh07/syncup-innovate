import { createFileRoute } from "@tanstack/react-router";
import { MessagesRoute } from "./messages";

export const Route = createFileRoute("/messages/$conversationId")({
  head: () => ({ meta: [{ title: "Messages | SyncUp" }] }),
  component: MessagesRoute,
});
