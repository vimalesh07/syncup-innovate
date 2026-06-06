import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Ban,
  Bookmark,
  CalendarDays,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  MoreVertical,
  Send,
  Share2,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { SafeAvatar } from "@/components/app/SafeAvatar";
import { supabase } from "@/integrations/supabase/client";
import { Profile, profileCompletion } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { notifyFollowers } from "@/lib/social";
import { directMessageNotification, insertNotification } from "@/lib/notifications";

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

type LikedUser = Profile & {
  following: boolean;
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
  const [postText, setPostText] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("syncup_dashboard_post_draft") ?? "";
  });
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedMode, setFeedMode] = useState<"all" | "following">(() => {
    if (typeof window === "undefined") return "all";
    return window.localStorage.getItem("syncup_dashboard_feed_mode") === "following" ? "following" : "all";
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [shareTargets, setShareTargets] = useState<ShareTarget[]>([]);
  const [postToShare, setPostToShare] = useState<Post | null>(null);
  const [postToReport, setPostToReport] = useState<Post | null>(null);
  const [likesPost, setLikesPost] = useState<Post | null>(null);
  const [likedUsers, setLikedUsers] = useState<LikedUser[]>([]);
  const [reportReason, setReportReason] = useState("Harassment or hate");
  const [reportDetails, setReportDetails] = useState("");
  const [sharingTo, setSharingTo] = useState<string | null>(null);
  const [likesLoading, setLikesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const loadHome = async () => {
    if (!user) return;
    setLoading(true);

    const followingRows = await (supabase as any)
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id);
    const blockRows = await (supabase as any)
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id);
    const followingIds = ((followingRows.data as Array<{ following_id: string }>) ?? []).map((item) => item.following_id);
    const blockedIds = ((blockRows.data as Array<{ blocked_id: string }>) ?? []).map((item) => item.blocked_id);
    const visibleAuthorIds = feedMode === "following" ? [...new Set([user.id, ...followingIds])] : [];

    let postQuery = (supabase as any).from("posts").select("*").order("created_at", { ascending: false }).limit(30);
    if (feedMode === "following") {
      if (!visibleAuthorIds.length) {
        setPosts([]);
        setTeams([]);
        setShareTargets([]);
        setLoading(false);
        return;
      }
      postQuery = postQuery.in("user_id", visibleAuthorIds);
    }

    const postRows = await postQuery;
    const rows = ((postRows.data as Array<Omit<Post, "profile" | "likes" | "comments" | "shares" | "liked">>) ?? [])
      .filter((post) => !blockedIds.includes(post.user_id));
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

    const profileMap = new Map(
      [...(profileRows.data as Profile[] ?? []), ...(commenterRows.data as Profile[] ?? [])]
        .filter((item) => item?.id)
        .map((item) => {
          const normalizedProfile = normalizeFeedProfile(item);
          return [normalizedProfile.id, normalizedProfile] as const;
        }),
    );
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

      setShareTargets(
        ((memberProfiles.data as Profile[]) ?? [])
          .filter((item) => item?.id)
          .map((item) => {
            const normalizedProfile = normalizeFeedProfile(item);
            return {
              ...normalizedProfile,
              teamNames: memberTeamMap.get(normalizedProfile.id) ?? [],
            };
          }),
      );
    } else {
      setShareTargets([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadHome();
  }, [user?.id, feedMode]);

  useEffect(() => {
    window.localStorage.setItem("syncup_dashboard_post_draft", postText);
  }, [postText]);

  useEffect(() => {
    window.localStorage.setItem("syncup_dashboard_feed_mode", feedMode);
  }, [feedMode]);

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
    await notifyFollowers(
      user.id,
      "New post from someone you follow",
      `${profile?.full_name || profile?.username || user.email} shared a new post.`,
    );
    setPostText("");
    window.localStorage.removeItem("syncup_dashboard_post_draft");
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

  const openLikedUsers = async (post: Post) => {
    if (!user) return;
    setLikesPost(post);
    setLikesLoading(true);
    setLikedUsers([]);

    const likeResult = await (supabase as any)
      .from("post_likes")
      .select("user_id, created_at")
      .eq("post_id", post.id)
      .order("created_at", { ascending: false });

    if (likeResult.error) {
      toast.error(likeResult.error.message);
      setLikesLoading(false);
      return;
    }

    const likeRows = (likeResult.data as Array<{ user_id: string }>) ?? [];
    const likedUserIds = [...new Set(likeRows.map((like) => like.user_id))];
    if (!likedUserIds.length) {
      setLikesLoading(false);
      return;
    }

    const [profileResult, followingResult] = await Promise.all([
      supabase.from("profiles").select("*").in("id", likedUserIds),
      (supabase as any)
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .in("following_id", likedUserIds),
    ]);

    if (profileResult.error) {
      toast.error(profileResult.error.message);
      setLikesLoading(false);
      return;
    }

    const followingIds = new Set(((followingResult.data as Array<{ following_id: string }>) ?? []).map((row) => row.following_id));
    const profileMap = new Map(
      ((profileResult.data as Profile[]) ?? [])
        .filter((item) => item?.id)
        .map((item) => {
          const normalizedProfile = normalizeFeedProfile(item);
          return [normalizedProfile.id, normalizedProfile] as const;
        }),
    );

    setLikedUsers(
      likedUserIds
        .map((id) => profileMap.get(id))
        .filter(Boolean)
        .map((item) => {
          const normalizedProfile = normalizeFeedProfile(item as Profile);
          return { ...normalizedProfile, following: followingIds.has(normalizedProfile.id) };
        }),
    );
    setLikesLoading(false);
  };

  const toggleFollowFromLikes = async (likedUser: LikedUser) => {
    if (!user || likedUser.id === user.id) return;

    if (likedUser.following) {
      const { error } = await (supabase as any)
        .from("user_follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", likedUser.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await (supabase as any)
        .from("user_follows")
        .insert({ follower_id: user.id, following_id: likedUser.id });
      if (error) {
        toast.error(error.message.includes("duplicate") ? "Already following." : error.message);
        return;
      }
    }

    setLikedUsers((current) => (
      current.map((item) => item.id === likedUser.id ? { ...item, following: !item.following } : item)
    ));
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

  const openReport = (post: Post) => {
    setPostToReport(post);
    setReportReason("Harassment or hate");
    setReportDetails("");
  };

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !postToReport) return;

    const { error } = await (supabase as any).from("post_reports").insert({
      post_id: postToReport.id,
      reporter_id: user.id,
      reported_user_id: postToReport.user_id,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });

    if (error) {
      toast.error(error.message.includes("duplicate") ? "You already reported this post." : error.message);
      return;
    }

    toast.success("Report sent. Thanks for helping keep SyncUp safe.");
    setPostToReport(null);
  };

  const blockUser = async (post: Post) => {
    if (!user || post.user_id === user.id) return;
    const { error } = await (supabase as any).from("user_blocks").insert({
      blocker_id: user.id,
      blocked_id: post.user_id,
    });

    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
      return;
    }

    setPosts((current) => current.filter((item) => item.user_id !== post.user_id));
    toast.success(`${post.profile?.full_name || post.profile?.username || "User"} blocked. Their posts are hidden.`);
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
    await insertNotification(directMessageNotification({
      userId: target.id,
      senderId: user.id,
      receiverId: target.id,
      senderName: profile?.full_name || profile?.username || user.email || "SyncUp user",
      senderAvatar: profile?.avatar_url ?? null,
      conversationId: `direct-${user.id}`,
      messagePreview: message,
    }));
    toast.success(`Post shared to ${target.full_name || target.username || "profile"}'s DM.`);
    setPostToShare(null);
    await loadHome();
  };

  return (
    <div className="dashboard-shell grid min-w-0 gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(600px,680px)_300px]">
      <aside className="hidden space-y-4 lg:block">
        <section className="syncup-card overflow-hidden p-0">
          <div className="px-4 py-4">
            <div>
              <SafeAvatar profile={profile} fallback={user?.email} className="h-20 w-20 border-4 border-white text-xl shadow-sm dark:border-slate-800" />
            </div>
            <h2 className="mt-3 text-base font-bold text-slate-950 dark:text-slate-50">{profile?.full_name || profile?.username || "SyncUp user"}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">{profile?.role || profile?.bio || "Student builder"}</p>
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5" />
              {profile?.college || "College or location not added"}
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-600 dark:text-slate-300">Profile strength</span>
                <span className="text-cyan-700 dark:text-cyan-300">{profileCompletion(profile)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full rounded-full bg-cyan-700 dark:bg-cyan-300" style={{ width: `${profileCompletion(profile)}%` }} />
              </div>
            </div>
            <div className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-700">
              <SidebarStat label="Teams" value={teams.length} />
            </div>
          </div>
        </section>

        <section className="syncup-card p-3">
          <Link to="/saved-competitions" className="syncup-shortcut"><Bookmark className="h-4 w-4" /> Saved</Link>
          <Link to="/my-teams" className="syncup-shortcut"><Users className="h-4 w-4" /> Teams</Link>
          <Link to="/discover" className="syncup-shortcut"><Trophy className="h-4 w-4" /> Competitions</Link>
          <Link to="/discover" className="syncup-shortcut"><CalendarDays className="h-4 w-4" /> Events</Link>
        </section>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="syncup-card p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-bold text-slate-950 dark:text-slate-50">Home</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Posts from builders, teams, and collaborators.</p>
            </div>
            <div className="grid grid-cols-2 rounded-full border border-slate-200 bg-slate-100 p-1 text-sm dark:border-slate-700 dark:bg-slate-800">
              {(["all", "following"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFeedMode(mode)}
                  className={`rounded-full px-4 py-2 font-semibold capitalize transition ${
                    feedMode === mode ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={createPost} className="syncup-card p-4">
          <div className="flex items-start gap-3">
            <SafeAvatar profile={profile} fallback={user?.email} className="h-12 w-12" />
            <textarea
              value={postText}
              onChange={(event) => setPostText(event.target.value)}
              rows={3}
              maxLength={700}
              className="min-h-20 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-cyan-700 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:placeholder:text-slate-400 dark:focus:border-cyan-300"
              placeholder="Start a post"
            />
          </div>
          <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">{postText.length}/700</p>
            <button disabled={posting || !postText.trim()} className="inline-flex items-center gap-2 rounded-full bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-60 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200">
              <Send className="h-4 w-4" />
              Post
            </button>
          </div>
        </form>

        {loading ? (
          <div className="syncup-card p-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading posts...</div>
        ) : posts.length ? posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            commentText={commentText[post.id] ?? ""}
            setCommentText={(value) => setCommentText((current) => ({ ...current, [post.id]: value }))}
            onLike={() => toggleLike(post)}
            onOpenLikes={() => openLikedUsers(post)}
            onComment={(event) => addComment(event, post)}
            onShare={() => sharePost(post)}
            onDelete={() => deletePost(post)}
            onReport={() => openReport(post)}
            onBlock={() => blockUser(post)}
            currentUserId={user?.id}
          />
        )) : (
          <div className="syncup-card border-dashed p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {feedMode === "following" ? "No posts from people you follow yet. Follow builders from their profiles to build your feed." : "No posts yet. Share the first team invite or hackathon update."}
          </div>
        )}
      </section>

      <aside className="hidden space-y-4 xl:block">
        <section className="syncup-card p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-slate-50"><Users className="h-5 w-5 text-cyan-700 dark:text-cyan-300" /> Your Teams</h2>
          <div className="mt-3 space-y-2">
            {teams.length ? teams.slice(0, 4).map((team) => (
              <Link key={team.id} to="/teams/$id" params={{ id: team.id }} className="block rounded-xl border border-slate-100 p-3 transition hover:border-cyan-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-cyan-700 dark:hover:bg-slate-800">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{team.team_name}</p>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{team.team_purpose || "Team"} · {team.project_title || "Project pending"}</p>
              </Link>
            )) : (
              <Link to="/my-teams" className="block rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 transition hover:border-cyan-200 hover:text-cyan-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-cyan-700 dark:hover:text-cyan-300">
                Join or create a team to see it here.
              </Link>
            )}
          </div>
        </section>
        <section className="syncup-card p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-slate-50"><UserPlus className="h-5 w-5 text-cyan-700 dark:text-cyan-300" /> Suggested Builders</h2>
          <div className="mt-3 space-y-3">
            {shareTargets.slice(0, 3).map((target) => (
              <Link key={target.id} to="/profiles/$id" params={{ id: target.id }} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                <SafeAvatar profile={target} className="h-10 w-10 text-xs" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{target.full_name || target.username || "SyncUp user"}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{target.role || target.teamNames[0] || "Builder"}</span>
                </span>
              </Link>
            ))}
            {!shareTargets.length && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">Collaborator suggestions appear after you join teams.</p>}
          </div>
        </section>
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
                    <SafeAvatar profile={target} className="h-12 w-12" />
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

      {postToReport && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <motion.form initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} onSubmit={submitReport} className="glass-strong neon-border w-full max-w-lg rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Report post</h2>
                <p className="mt-1 text-sm text-white/55">Tell us what feels unsafe or against the guidelines.</p>
              </div>
              <button type="button" onClick={() => setPostToReport(null)} className="rounded-xl p-2 text-white/60 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 rounded-2xl bg-white/5 p-4">
              <p className="line-clamp-3 text-sm text-white/65">{postToReport.content}</p>
            </div>
            <label className="mt-5 block text-xs text-white/60">Reason</label>
            <select
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
            >
              <option>Harassment or hate</option>
              <option>Spam or scam</option>
              <option>False or misleading opportunity</option>
              <option>Private information</option>
              <option>Inappropriate content</option>
              <option>Other</option>
            </select>
            <label className="mt-4 block text-xs text-white/60">Details</label>
            <textarea
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              rows={4}
              maxLength={500}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-cyan-300"
              placeholder="Optional context for review"
            />
            <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold">
              <Flag className="h-4 w-4" />
              Submit report
            </button>
          </motion.form>
        </div>
      )}

      {likesPost && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 px-0 backdrop-blur-sm sm:items-center sm:px-4">
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="glass-strong neon-border max-h-[82vh] w-full overflow-hidden rounded-t-3xl p-0 shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-xl font-bold">Liked by</h2>
                <p className="text-xs text-white/45">{likesPost.likes} like{likesPost.likes === 1 ? "" : "s"}</p>
              </div>
              <button onClick={() => setLikesPost(null)} className="rounded-xl p-2 text-white/60 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-4">
              {likesLoading ? (
                <div className="grid min-h-36 place-items-center text-sm text-white/55">Loading likes...</div>
              ) : likedUsers.length ? likedUsers.map((likedUser) => (
                <div key={likedUser.id} className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-white/5">
                  <Link to="/profiles/$id" params={{ id: likedUser.id }} onClick={() => setLikesPost(null)} className="flex min-w-0 flex-1 items-center gap-3">
                    <SafeAvatar profile={likedUser} className="h-12 w-12" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {likedUser.full_name || likedUser.username || "SyncUp user"}
                      </span>
                      <span className="block truncate text-xs text-white/50">
                        {likedUser.role || likedUser.college || likedUser.bio || "@profile"}
                      </span>
                    </span>
                  </Link>
                  {likedUser.id !== user?.id && (
                    <button
                      onClick={() => toggleFollowFromLikes(likedUser)}
                      className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                        likedUser.following
                          ? "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                          : "bg-cyan-300 text-[#0B0F19] hover:bg-cyan-200"
                      }`}
                    >
                      {likedUser.following ? "Following" : "Follow"}
                    </button>
                  )}
                </div>
              )) : (
                <div className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-sm text-white/55">
                  No likes yet
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function normalizeFeedProfile(profile: Profile): Profile {
  return {
    ...profile,
    full_name: textOrNull(profile.full_name),
    username: textOrNull(profile.username),
    avatar_url: textOrNull(profile.avatar_url),
    bio: textOrNull(profile.bio),
    college: textOrNull(profile.college),
    role: textOrNull(profile.role),
    github_url: textOrNull(profile.github_url),
    linkedin_url: textOrNull(profile.linkedin_url),
    portfolio_url: textOrNull(profile.portfolio_url),
    skills: normalizeFeedSkills(profile.skills),
    reliability_score: Number.isFinite(Number(profile.reliability_score)) ? Number(profile.reliability_score) : 100,
  };
}

function normalizeFeedSkills(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((skill) => `${skill}`.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((skill) => skill.trim()).filter(Boolean);
  }
  return [];
}

function textOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function SidebarStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-bold text-cyan-700 dark:text-cyan-300">{value}</span>
    </div>
  );
}

function PostText({ content }: { content: string }) {
  const parts = content.split(/(#[\w-]+)/g);
  return (
    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-300">
      {parts.map((part, index) => (
        part.startsWith("#")
          ? <span key={`${part}-${index}`} className="font-semibold text-cyan-700 dark:text-cyan-300">{part}</span>
          : <span key={`${part}-${index}`}>{part}</span>
      ))}
    </p>
  );
}

function PostCard({
  post,
  commentText,
  setCommentText,
  onLike,
  onOpenLikes,
  onComment,
  onShare,
  onDelete,
  onReport,
  onBlock,
  currentUserId,
}: {
  post: Post;
  commentText: string;
  setCommentText: (value: string) => void;
  onLike: () => void;
  onOpenLikes: () => void;
  onComment: (event: React.FormEvent) => void;
  onShare: () => void;
  onDelete: () => void;
  onReport: () => void;
  onBlock: () => void;
  currentUserId?: string;
}) {
  const { profile: viewerProfile, user: viewerUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentLikes, setCommentLikes] = useState<Record<string, string[]>>(() => readLocalCommentLikes());
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "light";
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const replyToComment = (comment: Comment) => {
    const handle = comment.profile?.username || comment.profile?.full_name?.split(" ")[0] || "builder";
    setCommentsOpen(true);
    setCommentText(`@${handle} `);
    window.setTimeout(() => commentInputRef.current?.focus(), 0);
  };

  const toggleComments = () => {
    setCommentsOpen((open) => {
      if (!open) window.setTimeout(() => commentInputRef.current?.focus(), 0);
      return !open;
    });
  };

  const toggleCommentLike = (commentId: string) => {
    if (!viewerUser) return;
    setCommentLikes((current) => {
      const likedBy = current[commentId] ?? [];
      const nextLikedBy = likedBy.includes(viewerUser.id)
        ? likedBy.filter((id) => id !== viewerUser.id)
        : [...likedBy, viewerUser.id];
      const next = { ...current, [commentId]: nextLikedBy };
      saveLocalCommentLikes(next);
      return next;
    });
  };

  return (
    <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="syncup-card p-4 transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
      <Link to="/profiles/$id" params={{ id: post.user_id }} className="flex min-w-0 items-center gap-3 rounded-xl transition hover:bg-slate-50 dark:hover:bg-slate-800">
        <SafeAvatar profile={post.profile} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-950 dark:text-slate-50">{post.profile?.full_name || post.profile?.username || "SyncUp user"}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{post.profile?.role || "Builder"} · {timeAgo(post.created_at)}</p>
        </div>
      </Link>
        <div className="relative">
          <button onClick={() => setMenuOpen((current) => !current)} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" title="Post options">
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div
              className={`absolute right-0 top-10 z-20 w-48 rounded-xl border p-2 shadow-2xl ${
                theme === "light" ? "border-slate-200 bg-white text-slate-900" : "border-white/10 bg-[#101827] text-white"
              }`}
            >
              {currentUserId === post.user_id ? (
                <button onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                  Delete post
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setMenuOpen(false); onReport(); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
                      theme === "light" ? "text-slate-700 hover:bg-slate-100" : "text-white/75 hover:bg-white/10"
                    }`}
                  >
                    <Flag className={`h-4 w-4 ${theme === "light" ? "text-cyan-700" : "text-cyan-200"}`} />
                    Report post
                  </button>
                  <button onClick={() => { setMenuOpen(false); onBlock(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50">
                    <Ban className="h-4 w-4" />
                    Block user
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <PostText content={post.content} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-700">
        <div className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:hover:bg-slate-800 ${post.liked ? "text-red-600 dark:text-red-300" : "text-slate-600 dark:text-slate-400"}`}>
          <button onClick={onLike} className="flex items-center gap-2 transition hover:text-red-600 dark:hover:text-red-300">
            <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} />
            <span>Like</span>
          </button>
          {post.likes > 0 && (
            <button
              type="button"
              onClick={onOpenLikes}
              className="rounded-md px-1 font-semibold transition hover:text-cyan-700 dark:hover:text-cyan-300"
              title="See who liked this post"
            >
              {post.likes}
            </button>
          )}
        </div>
        <button onClick={toggleComments} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
          <MessageCircle className="h-4 w-4" />
          Comment {post.comments.length ? post.comments.length : ""}
        </button>
        <button onClick={onShare} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
          <Share2 className="h-4 w-4" />
          Share {post.shares ? post.shares : ""}
        </button>
        <button type="button" className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
          <Bookmark className="h-4 w-4" />
          Save
        </button>
      </div>
      {commentsOpen && (
        <div className="mt-3 space-y-2">
          {post.comments.map((comment) => {
            const likedBy = commentLikes[comment.id] ?? [];
            const commentLiked = viewerUser ? likedBy.includes(viewerUser.id) : false;
            const commentLikeCount = likedBy.length;

            return (
              <div key={comment.id} className="group flex items-start gap-2.5">
                <Link to="/profiles/$id" params={{ id: comment.user_id }} className="shrink-0">
                  <SafeAvatar profile={comment.profile} className="h-8 w-8 text-xs" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div
                    className={`inline-block max-w-full rounded-2xl px-3 py-2 text-left sm:max-w-[82%] ${
                      theme === "light"
                        ? "bg-slate-100 text-slate-900"
                        : "bg-white/[0.07] text-white"
                    }`}
                  >
                    <Link to="/profiles/$id" params={{ id: comment.user_id }} className="block text-[13px] font-bold leading-4 hover:text-cyan-200">
                      {comment.profile?.full_name || comment.profile?.username || "SyncUp user"}
                    </Link>
                    <p className={`mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-5 ${theme === "light" ? "text-slate-700" : "text-white/70"}`}>
                      {comment.content}
                    </p>
                  </div>
                  <div className={`ml-3 mt-1 flex items-center gap-3 text-[11px] font-semibold ${theme === "light" ? "text-slate-500" : "text-white/40"}`}>
                    <button
                      type="button"
                      onClick={() => toggleCommentLike(comment.id)}
                      className={`transition hover:text-cyan-200 ${commentLiked ? "text-cyan-300" : ""}`}
                    >
                      Like{commentLikeCount ? ` ${commentLikeCount}` : ""}
                    </button>
                    <button type="button" onClick={() => replyToComment(comment)} className="transition hover:text-cyan-200">Reply</button>
                    <span className="font-medium">{timeAgo(comment.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          <form onSubmit={onComment} className="flex items-center gap-2.5 pt-1">
            <SafeAvatar profile={viewerProfile} fallback={viewerUser?.email} className="h-8 w-8 text-xs" />
            <div
              className={`flex min-w-0 flex-1 items-center rounded-full border px-3 py-1.5 transition focus-within:border-cyan-300 ${
                theme === "light"
                  ? "border-slate-200 bg-slate-100"
                  : "border-white/10 bg-white/[0.06]"
              }`}
            >
              <input
                ref={commentInputRef}
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                className={`min-w-0 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none ${
                  theme === "light" ? "text-slate-900 placeholder:text-slate-500" : "text-white placeholder:text-white/40"
                }`}
                placeholder="Add a comment..."
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${
                  commentText.trim()
                    ? "bg-cyan-300 text-[#0B0F19] hover:bg-cyan-200"
                    : theme === "light"
                      ? "text-slate-400"
                      : "text-white/35"
                }`}
                title="Send comment"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </motion.article>
  );
}

function readLocalCommentLikes() {
  if (typeof window === "undefined") return {} as Record<string, string[]>;
  try {
    return JSON.parse(window.localStorage.getItem("syncup_comment_likes") ?? "{}") as Record<string, string[]>;
  } catch {
    return {};
  }
}

function saveLocalCommentLikes(value: Record<string, string[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("syncup_comment_likes", JSON.stringify(value));
}

function timeAgo(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

function SignalScout() {
  const newTarget = () => ({ x: Math.floor(Math.random() * 5), y: Math.floor(Math.random() * 5) });
  const [target, setTarget] = useState(newTarget);
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null);
  const distance = guess ? Math.abs(target.x - guess.x) + Math.abs(target.y - guess.y) : null;

  return (
    <section className="syncup-card p-4">
      <h2 className="text-base font-bold text-slate-950 dark:text-slate-50">Signal Scout</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{distance === 0 ? "Perfect lock." : distance === null ? "Find the hidden signal." : `${distance} steps away.`}</p>
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
              className={`aspect-square rounded-lg border text-xs font-bold transition ${active ? "border-cyan-600 bg-cyan-50 text-cyan-800 dark:border-cyan-300 dark:bg-cyan-300/15 dark:text-cyan-100" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"}`}
            >
              {active ? (distance === 0 ? "ON" : distance) : ""}
            </button>
          );
        })}
      </div>
    </section>
  );
}
