import { supabase } from "@/integrations/supabase/client";

export async function notifyFollowers(
  authorId: string,
  title: string,
  message: string,
) {
  const { data: follows, error } = await (supabase as any)
    .from("user_follows")
    .select("follower_id")
    .eq("following_id", authorId);

  if (error) return;

  const recipients = [...new Set(((follows as Array<{ follower_id: string }>) ?? []).map((item) => item.follower_id))]
    .filter((id) => id !== authorId);

  if (!recipients.length) return;

  await supabase.from("notifications").insert(
    recipients.map((user_id) => ({
      user_id,
      title,
      message,
    })),
  );
}
