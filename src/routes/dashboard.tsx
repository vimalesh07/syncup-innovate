import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Send, Share2, Trash2, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { supabase } from "@/integrations/supabase/client";
import { Profile, initials } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Home | SyncUp" }] }),
  component: DashboardRoute,
});

type Team = {
  id: string;
  team_name: string;
  team_purpose?: string | null;
  project_title: string | null;
};

type Post = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile | null;
  likes: number;
  comments: Comment[];
  shares: number;
  liked: boolean;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile | null;
};

type ShareTarget = Profile & {
  teamNames: string[];
};

function DashboardRoute() {
  return (
    <ProtectedPage>
      <PlatformShell>
        <HomeFeed />
      </PlatformShell>
    </ProtectedPage>
  );
}

function HomeFeed() {
  const { profile, user } = useAuth();
  const [postText, setPostText] = useState("");
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [shareTargets, setShareTargets] = useState<ShareTarget[]>([]);
  const [postToShare, setPostToShare] = useState<Post | null>(null);
  const [sharingTo, setSharingTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const loadHome = async () => {
    if (!user) return;
    setLoading(true);

    const postRows = await (supabase as any).from("posts").select("*").order("created_at", { ascending: false }).limit(30);
    const rows = (postRows.data as Array<Omit<Post, "profile" | "likes" | "comments" | "shares" | "liked">>) ?? [];
    const postIds = rows.map((post) => post.id);

    const [profileRows, likeRows, commentRows, shareRows, memberships] = await Promise.all([
      rows.length ? supabase.from("profiles").select("*").in("id", [...new Set(rows.map((post) => post.user_id))]) : { data: [] },
      postIds.length ? (supabase as any).from("post_likes").select("*").in("post_id", postIds) : { data: [] },
      postIds.length ? (supabase as any).from("post_comments").select("*").in("post_id", postIds).order("created_at", { ascending: true }) : { data: [] },
      postIds.length ? (supabase as any).from("post_shares").select("*").in("post_id", postIds) : { data: [] },
      supabase.from("team_members").select("team_id").eq("user_id", user.id),
    ]);

    const comments = (commentRows.data as Comment[]) ?? [];
    const commenterIds = [...new Set(comments.map((comment) => comment.user_id))];
    const commenterRows = commenterIds.length ? await supabase.from("profiles").select("*").in("id", commenterIds) : { data: [] };

    const profileMap = new Map([...(profileRows.data as Profile[] ?? []), ...(commenterRows.data as Profile[] ?? [])].map((item) => [item.id, item]));
    const likes = (likeRows.data as Array<{ post_id: string; user_id: string }>) ?? [];
    const shares = (shareRows.data as Array<{ post_id: string }>) ?? [];

    setPosts(rows.map((post) => ({
      ...post,
      profile: profileMap.get(post.user_id) ?? null,
      likes: likes.filter((like) => like.post_id === post.id).length,
      shares: shares.filter((share) => share.post_id === post.id).length,
      liked: likes.some((like) => like.post_id === post.id && like.user_id === user.id),
      comments: comments
        .filter((comment) => comment.post_id === post.id)
        .map((comment) => ({ ...comment, profile: profileMap.get(comment.user_id) ?? null })),
    })));

    const teamIds = [...new Set(((memberships.data as Array<{ team_id: string }>) ?? []).map((row) => row.team_id))];
    const teamResult = teamIds.length ? await supabase.from("teams").select("id, team_name, team_purpose, project_title").in("id", teamIds).limit(8) : { data: [] };
    const joinedTeams = (teamResult.data as Team[]) ?? [];
    setTeams(joinedTeams);

    if (teamIds.length) {
      const memberRows = await supabase.from("team_members").select("team_id, user_id").in("team_id", teamIds);
      const members = ((memberRows.data as Array<{ team_id: string; user_id: string }>) ?? []).filter((member) => member.user_id !== user.id);
      const memberIds = [...new Set(members.map((member) => member.user_id))];
      const memberProfiles = memberIds.length ? await supabase.from("profiles").select("*").in("id", memberIds) : { data: [] };
      const teamNameMap = new Map(joinedTeams.map((team) => [team.id, team.team_name]));
      const memberTeamMap = members.reduce((map, member) => {
        const next = map.get(member.user_id) ?? [];
        const teamName = teamNameMap.get(member.team_id);
        if (teamName && !next.includes(teamName)) next.push(teamName);
        map.set(member.user_id, next);
        return map;
      }, new Map<string, string[]>());

      setShareTargets(((memberProfiles.data as Profile[]) ?? []).map((item) => ({
        ...item,
        teamNames: memberTeamMap.get(item.id) ?? [],
      })));
    } else {
      setShareTargets([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadHome();
  }, [user?.id]);

  const createPost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !postText.trim()) return;
    setPosting(true);
    const { error } = await (supabase as any).from("posts").insert({ user_id: user.id, content: postText.trim() });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPostText("");
    await loadHome();
  };

  const toggleLike = async (post: Post) => {
    if (!user) return;
    if (post.liked) {
      await (supabase as any).from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await (supabase as any).from("post_likes").insert({ post_id: post.id, user_id: user.id });
    }
    await loadHome();
  };

  const addComment = async (event: React.FormEvent, post: Post) => {
    event.preventDefault();
    if (!user || !commentText[post.id]?.trim()) return;
    const content = commentText[post.id].trim();
    setCommentText((current) => ({ ...current, [post.id]: "" }));
    const { error } = await (supabase as any).from("post_comments").insert({ post_id: post.id, user_id: user.id, content });
    if (error) {
      toast.error(error.message);
      setCommentText((current) => ({ ...current, [post.id]: content }));
      return;
    }
    await loadHome();
  };

  const sharePost = async (post: Post) => {
    setPostToShare(post);
  };

  const deletePost = async (post: Post) => {
    if (!user || post.user_id !== user.id) return;
    const { error } = await (supabase as any).from("posts").delete().eq("id", post.id).eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Post deleted.");
    await loadHome();
  };

  const sharePostToDm = async (target: ShareTarget) => {
    if (!user || !postToShare) return;
    setSharingTo(target.id);
    const author = postToShare.profile?.full_name || postToShare.profile?.username || "a SyncUp builder";
    const message = `Shared a SyncUp post from ${author}:\n\n${postToShare.content}`;

    const [dmResult, shareResult] = await Promise.all([
      (supabase as any).from("direct_messages").insert({
        sender_id: user.id,
        recipient_id: target.id,
        message,
      }),
      (supabase as any).from("post_shares").insert({ post_id: postToShare.id, user_id: user.id }),
    ]);

    setSharingTo(null);
    const error = dmResult.error || shareResult.error;
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: target.id,
      title: "Post shared with you",
      message: `${profile?.full_name || profile?.username || user.email} shared a post to your messages.`,
    });
    toast.success(`Post shared to ${target.full_name || target.username || "profile"}'s DM.`);
    setPostToShare(null);
    await loadHome();
  };

  const composerPlaceholder = useMemo(() => (
    "Example: We need a UI/UX designer for a hackathon team this weekend. DM me if you can join."
  ), []);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.38fr]">
      <section className="space-y-5">
        <div className="glass-strong neon-border rounded-2xl p-6">
          <h1 className="text-3xl font-bold">Home</h1>
          <p className="mt-2 text-white/55">Posts from builders, teams, and hackathon collaborators.</p>
        </div>

        <form onSubmit={createPost} className="glass-strong rounded-2xl p-5">
          <div className="flex gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 font-bold">
                {initials(profile, user?.email)}
              </span>
            )}
            <textarea
              value={postText}
              onChange={(event) => setPostText(event.target.value)}
              rows={3}
              maxLength={700}
              className="min-h-24 flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
              placeholder={composerPlaceholder}
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-white/40">{postText.length}/700</p>
            <button disabled={posting || !postText.trim()} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold disabled:opacity-60">
              <Send className="h-4 w-4" />
              Post
            </button>
          </div>
        </form>

        {loading ? (
          <div className="glass-strong rounded-2xl p-10 text-center text-white/55">Loading posts...</div>
        ) : posts.length ? posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            commentText={commentText[post.id] ?? ""}
            setCommentText={(value) => setCommentText((current) => ({ ...current, [post.id]: value }))}
            onLike={() => toggleLike(post)}
            onComment={(event) => addComment(event, post)}
            onShare={() => sharePost(post)}
            onDelete={() => deletePost(post)}
            currentUserId={user?.id}
          />
        )) : (
          <div className="glass-strong rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/55">
            No posts yet. Share the first team invite or hackathon update.
          </div>
        )}
      </section>

      <aside className="space-y-5">
        <section className="glass-strong rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5 text-cyan-300" /> Your Teams</h2>
          <div className="mt-4 space-y-3">
            {teams.length ? teams.map((team) => (
              <Link key={team.id} to="/teams/$id" params={{ id: team.id }} className="block rounded-xl bg-white/5 p-4 hover:bg-white/10">
                <p className="font-semibold">{team.team_name}</p>
                <p className="text-xs text-white/50">{team.team_purpose || "Team"} · {team.project_title || "Project pending"}</p>
              </Link>
            )) : <p className="rounded-xl bg-white/5 p-4 text-sm text-white/55">Join or create a team to see it here.</p>}
          </div>
        </section>
        <SignalScout />
      </aside>

      {postToShare && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="glass-strong neon-border w-full max-w-2xl rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Share to DM</h2>
                <p className="mt-1 text-sm text-white/55">Choose someone from your joined team accounts.</p>
              </div>
              <button onClick={() => setPostToShare(null)} className="rounded-xl p-2 text-white/60 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-white/5 p-4">
              <p className="line-clamp-3 text-sm text-white/65">{postToShare.content}</p>
            </div>

            <div className="mt-5 max-h-[50vh] space-y-3 overflow-y-auto">
              {shareTargets.length ? shareTargets.map((target) => (
                <button
                  key={target.id}
                  onClick={() => sharePostToDm(target)}
                  disabled={sharingTo === target.id}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10 disabled:opacity-60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {target.avatar_url ? (
                      <img src={target.avatar_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 font-bold">
                        {initials(target)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{target.full_name || target.username || "SyncUp user"}</p>
                      <p className="truncate text-xs text-white/50">{target.teamNames.join(", ") || target.role || "Team member"}</p>
                    </div>
                  </div>
                  <span className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-semibold">
                    {sharingTo === target.id ? "Sharing..." : "Share"}
                  </span>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-sm text-white/55">
                  No joined-team profiles found yet. Join a team with members to share posts by DM.
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  commentText,
  setCommentText,
  onLike,
  onComment,
  onShare,
  onDelete,
  currentUserId,
}: {
  post: Post;
  commentText: string;
  setCommentText: (value: string) => void;
  onLike: () => void;
  onComment: (event: React.FormEvent) => void;
  onShare: () => void;
  onDelete: () => void;
  currentUserId?: string;
}) {
  return (
    <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
      <Link to="/profiles/$id" params={{ id: post.user_id }} className="flex items-center gap-3 rounded-xl transition hover:bg-white/5">
        {post.profile?.avatar_url ? (
          <img src={post.profile.avatar_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 font-bold">
            {initials(post.profile)}
          </span>
        )}
        <div>
          <p className="font-semibold">{post.profile?.full_name || post.profile?.username || "SyncUp user"}</p>
          <p className="text-xs text-white/45">{post.profile?.role || "Builder"} · {new Date(post.created_at).toLocaleString()}</p>
        </div>
      </Link>
        {currentUserId === post.user_id && (
          <button onClick={onDelete} className="rounded-xl p-2 text-red-200 hover:bg-red-500/10" title="Delete post">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/75">{post.content}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-white/10 py-3">
        <button onClick={onLike} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-white/10 ${post.liked ? "text-red-200" : "text-white/65"}`}>
          <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} />
          Like {post.likes ? post.likes : ""}
        </button>
        <button className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/65 transition hover:bg-white/10">
          <MessageCircle className="h-4 w-4" />
          Comment {post.comments.length ? post.comments.length : ""}
        </button>
        <button onClick={onShare} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/65 transition hover:bg-white/10">
          <Share2 className="h-4 w-4" />
          Share {post.shares ? post.shares : ""}
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {post.comments.slice(-3).map((comment) => (
          <div key={comment.id} className="rounded-xl bg-white/5 p-3">
            <Link to="/profiles/$id" params={{ id: comment.user_id }} className="text-sm font-semibold hover:text-cyan-200">
              {comment.profile?.full_name || comment.profile?.username || "SyncUp user"}
            </Link>
            <p className="mt-1 text-sm text-white/60">{comment.content}</p>
          </div>
        ))}
      </div>
      <form onSubmit={onComment} className="mt-4 flex gap-2">
        <input
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-cyan-300"
          placeholder="Add a comment..."
        />
        <button disabled={!commentText.trim()} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-50">
          Send
        </button>
      </form>
    </motion.article>
  );
}

function SignalScout() {
  const newTarget = () => ({ x: Math.floor(Math.random() * 5), y: Math.floor(Math.random() * 5) });
  const [target, setTarget] = useState(newTarget);
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null);
  const distance = guess ? Math.abs(target.x - guess.x) + Math.abs(target.y - guess.y) : null;

  return (
    <section className="glass-strong rounded-2xl p-5">
      <h2 className="text-lg font-semibold">Signal Scout</h2>
      <p className="mt-1 text-sm text-white/55">{distance === 0 ? "Perfect lock." : distance === null ? "Find the hidden signal." : `${distance} steps away.`}</p>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {Array.from({ length: 25 }).map((_, index) => {
          const x = index % 5;
          const y = Math.floor(index / 5);
          const active = guess?.x === x && guess?.y === y;
          return (
            <button
              key={`${x}-${y}`}
              onClick={() => setGuess({ x, y })}
              onDoubleClick={() => setTarget(newTarget())}
              className={`aspect-square rounded-lg border text-xs font-bold ${active ? "border-cyan-300 bg-cyan-300/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
            >
              {active ? (distance === 0 ? "ON" : distance) : ""}
            </button>
          );
        })}
      </div>
    </section>
  );
}
