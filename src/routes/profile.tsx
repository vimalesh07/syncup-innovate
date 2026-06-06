import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Award,
  Bookmark,
  Briefcase,
  Camera,
  Check,
  Copy,
  Edit3,
  Github,
  Globe,
  Grid3X3,
  Heart,
  Linkedin,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  Save,
  Share2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { SafeAvatar } from "@/components/app/SafeAvatar";
import { supabase } from "@/integrations/supabase/client";
import { Profile, profileCompletion } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My Profile | SyncUp" }] }),
  component: ProfileRoute,
});

const skillOptions = ["React", "AI/ML", "UI/UX", "Python", "Backend", "Research", "Pitching", "Product"];

type TeamSummary = {
  id: string;
  team_name: string;
  team_purpose?: string | null;
  project_title: string | null;
  leader_id: string;
};

type ProfilePost = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile | null;
  likes?: number | ProfilePostLike[];
  likeCount?: number;
  likesCount?: number;
  comments?: ProfilePostComment[] | number;
  commentCount?: number;
  commentsCount?: number;
  shares?: number | unknown[];
  shareCount?: number;
  sharesCount?: number;
};

type ProfilePostLike = {
  post_id: string;
  user_id: string;
  profile?: Profile | null;
};

type ProfilePostComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile | null;
};

type ProfileSlugUser = {
  id?: string | null;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type SocialListMode = "teams" | "followers" | "following";
type ProfileTab = "posts" | "projects" | "teams" | "achievements" | "activity";

function resolveProfileSlug(profile?: Partial<Profile> | null, user?: ProfileSlugUser | null) {
  const metadata = user?.user_metadata ?? {};
  const metadataUsername = typeof metadata.username === "string" ? metadata.username : "";
  const metadataName = typeof metadata.name === "string" ? metadata.name : "";
  const emailPrefix = user?.email?.split("@")[0] ?? "";
  const candidate = profile?.username || metadataUsername || metadataName || emailPrefix || user?.id || profile?.id || "";
  return `${candidate}`.trim().replace(/^@/, "");
}

function ProfileRoute() {
  const location = useLocation();
  const isProfileIndex = location.pathname.replace(/\/+$/, "") === "/profile";

  return (
    <ProtectedPage>
      <PlatformShell>
        {isProfileIndex ? <ProfileIndexRedirect /> : <Outlet />}
      </PlatformShell>
    </ProtectedPage>
  );
}

function ProfileIndexRedirect() {
  const { profile, user, loading } = useAuth();
  const navigate = useNavigate();
  const [redirectFailed, setRedirectFailed] = useState(false);

  useEffect(() => {
    if (loading) return;

    let active = true;
    const redirectToProfile = async () => {
      const currentProfile = profile;
      const currentUser = user;
      const directSlug = resolveProfileSlug(currentProfile, currentUser);

      if (directSlug) {
        navigate({ to: "/profile/$username", params: { username: directSlug }, replace: true });
        return;
      }

      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;
      if (!sessionUser) {
        if (active) setRedirectFailed(true);
        return;
      }

      const profileRow = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sessionUser.id)
        .maybeSingle();
      const fallbackSlug = resolveProfileSlug((profileRow.data as Profile) ?? null, sessionUser);

      if (!active) return;
      if (fallbackSlug) {
        navigate({ to: "/profile/$username", params: { username: fallbackSlug }, replace: true });
      } else {
        setRedirectFailed(true);
      }
    };

    redirectToProfile();
    return () => {
      active = false;
    };
  }, [loading, navigate, profile, user]);

  if (redirectFailed) {
    return (
      <section className="profile-card p-8 text-center">
        <h1 className="text-lg font-bold text-slate-950 dark:text-slate-50">Profile link unavailable</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">I could not find a username for this account yet.</p>
        <Link to="/dashboard" className="mt-5 inline-flex rounded-full bg-cyan-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-800 dark:bg-cyan-300 dark:text-slate-950">
          Back to home
        </Link>
      </section>
    );
  }

  return (
    <section className="profile-card p-8 text-center">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-700 dark:text-cyan-300" />
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Opening your profile...</p>
    </section>
  );
}

export function ProfilePage({ routeUsername }: { routeUsername?: string }) {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileNotFound, setProfileNotFound] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [socialStats, setSocialStats] = useState({ teams: 0, followers: 0, following: 0 });
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [profilePosts, setProfilePosts] = useState<ProfilePost[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<Profile[]>([]);
  const [listMode, setListMode] = useState<SocialListMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const DRAFT_KEY = user ? `profile_draft_${user.id}` : "";

  useEffect(() => {
    if (!user || !profile) return;

    let active = true;
    const loadRouteProfile = async () => {
      setProfileLoading(true);
      setProfileNotFound(false);
      const requestedUsername = routeUsername?.trim();

      if (!requestedUsername || requestedUsername === profile.username || requestedUsername === user.id) {
        if (!active) return;
        setProfileUser(profile);
        setProfileLoading(false);
        return;
      }

      const usernameResult = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", requestedUsername)
        .maybeSingle();
      const fallbackResult = usernameResult.data
        ? usernameResult
        : await supabase.from("profiles").select("*").eq("id", requestedUsername).maybeSingle();

      if (!active) return;
      setProfileUser((fallbackResult.data as Profile) ?? null);
      setProfileNotFound(!fallbackResult.data);
      setProfileLoading(false);
    };

    loadRouteProfile();
    return () => {
      active = false;
    };
  }, [routeUsername, profile, user?.id]);

  useEffect(() => {
    if (!user || !profileUser) return;
    const isCurrentUser = user.id === profileUser.id;

    if (!isCurrentUser || !DRAFT_KEY) {
      setForm(profileUser);
      setFormReady(true);
      return;
    }

    const draft = localStorage.getItem(DRAFT_KEY);
    if (!draft) {
      setForm(profileUser);
      setFormReady(true);
      return;
    }

    try {
      const draftData = JSON.parse(draft) as Partial<Profile>;
      const draftProfile = { ...profileUser, ...draftData, id: user.id } as Profile;

      if (profileCompletion(draftProfile) > profileCompletion(profileUser)) {
        setForm(draftProfile);
      } else {
        localStorage.removeItem(DRAFT_KEY);
        setForm(profileUser);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      setForm(profileUser);
    }
    setFormReady(true);
  }, [profileUser, user?.id, DRAFT_KEY]);

  useEffect(() => {
    if (!user || !formReady || !DRAFT_KEY || form.id !== user.id) return;
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    }, 500);
    return () => clearTimeout(timer);
  }, [form, formReady, user?.id, DRAFT_KEY]);

  useEffect(() => {
    if (!profileUser) return;
    const targetUserId = profileUser.id;
    Promise.all([
      supabase.from("team_members").select("team_id").eq("user_id", targetUserId),
      (supabase as any).from("user_follows").select("follower_id").eq("following_id", targetUserId),
      (supabase as any).from("user_follows").select("following_id").eq("follower_id", targetUserId),
      user?.id && user.id !== targetUserId
        ? (supabase as any).from("user_follows").select("id").eq("follower_id", user.id).eq("following_id", targetUserId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(async ([memberships, followerRows, followingRows, followRow]) => {
      const teamIds = [...new Set(((memberships.data as Array<{ team_id: string }>) ?? []).map((item) => item.team_id))];
      const followerIds = [...new Set(((followerRows.data as Array<{ follower_id: string }>) ?? []).map((item) => item.follower_id))];
      const followingIds = [...new Set(((followingRows.data as Array<{ following_id: string }>) ?? []).map((item) => item.following_id))];

      const [teamRows, followerProfiles, followingProfileRows] = await Promise.all([
        teamIds.length ? supabase.from("teams").select("id, team_name, team_purpose, project_title, leader_id").in("id", teamIds) : { data: [] },
        followerIds.length ? supabase.from("profiles").select("*").in("id", followerIds) : { data: [] },
        followingIds.length ? supabase.from("profiles").select("*").in("id", followingIds) : { data: [] },
      ]);

      setTeams((teamRows.data as TeamSummary[]) ?? []);
      setFollowers((followerProfiles.data as Profile[]) ?? []);
      setFollowingProfiles((followingProfileRows.data as Profile[]) ?? []);
      setSocialStats({
        teams: teamIds.length,
        followers: followerIds.length,
        following: followingIds.length,
      });
      setIsFollowing(Boolean(followRow.data));
    });
  }, [profileUser?.id, user?.id]);

  useEffect(() => {
    if (!profileUser) return;

    const loadProfilePosts = async () => {
      const postRows = await (supabase as any)
        .from("posts")
        .select("*")
        .eq("user_id", profileUser.id)
        .order("created_at", { ascending: false })
        .limit(30);

      const rows = (postRows.data as Array<Omit<ProfilePost, "profile" | "likes" | "comments" | "shares">>) ?? [];
      const postIds = rows.map((post) => post.id);

      const [likeRows, commentRows, shareRows] = await Promise.all([
        postIds.length ? (supabase as any).from("post_likes").select("*").in("post_id", postIds) : { data: [] },
        postIds.length ? (supabase as any).from("post_comments").select("*").in("post_id", postIds).order("created_at", { ascending: true }) : { data: [] },
        postIds.length ? (supabase as any).from("post_shares").select("*").in("post_id", postIds) : { data: [] },
      ]);

      const likes = (likeRows.data as Array<{ post_id: string; user_id: string }>) ?? [];
      const comments = (commentRows.data as ProfilePostComment[]) ?? [];
      const shares = (shareRows.data as Array<{ post_id: string }>) ?? [];
      const engagementUserIds = [
        ...new Set([
          ...likes.map((like) => like.user_id),
          ...comments.map((comment) => comment.user_id),
        ].filter(Boolean)),
      ];
      const engagementProfiles = engagementUserIds.length
        ? await supabase.from("profiles").select("*").in("id", engagementUserIds)
        : { data: [] };
      const profileById = new Map(((engagementProfiles.data as Profile[]) ?? []).map((item) => [item.id, item]));

      setProfilePosts(rows.map((post) => ({
        ...post,
        profile: profileUser,
        likes: likes
          .filter((like) => like.post_id === post.id)
          .map((like) => ({ ...like, profile: profileById.get(like.user_id) ?? null })),
        comments: comments
          .filter((comment) => comment.post_id === post.id)
          .map((comment) => ({ ...comment, profile: profileById.get(comment.user_id) ?? null })),
        shares: shares.filter((share) => share.post_id === post.id).length,
      })));
    };

    loadProfilePosts();
  }, [profileUser?.id]);

  const update = (key: keyof Profile, value: string | string[]) => setForm((current) => ({ ...current, [key]: value }));
  const skills = form.skills ?? [];
  const completion = profileCompletion(form as Profile);
  const displayName = form.full_name || profileUser?.full_name || profileUser?.username || "SyncUp innovator";
  const headline = form.role || "Student Innovator | Developer | Team Leader";
  const locationLine = form.college || "College or location not added";
  const aboutText = form.bio || "Building with teams, learning in public, and looking for meaningful innovation challenges.";
  const projectTeams = teams.filter((team) => team.project_title);
  const profileUserId = profileUser?.id || form.id;
  const isOwnProfile = Boolean(user?.id && profileUserId && user.id === profileUserId);
  const profileSlug = profileUser?.username || profileUser?.id || form.username || form.id || "";
  const profileShareLink = typeof window === "undefined" || !profileSlug ? "" : `${window.location.origin}/profile/${encodeURIComponent(profileSlug)}`;
  const encodedProfileLink = encodeURIComponent(profileShareLink);
  const shareText = encodeURIComponent("Check out my SyncUp profile");
  const shareTargets = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodedProfileLink}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedProfileLink}` },
    { label: "X / Twitter", href: `https://twitter.com/intent/tweet?url=${encodedProfileLink}&text=${shareText}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedProfileLink}` },
    { label: "Email", href: `mailto:?subject=My SyncUp Profile&body=${encodedProfileLink}` },
  ];

  const openShareModal = () => {
    setLinkCopied(false);
    setShareOpen(true);
  };

  const copyProfileLink = async () => {
    if (!profileShareLink) return;
    await navigator.clipboard.writeText(profileShareLink);
    setLinkCopied(true);
    toast.success("Link copied.");
  };

  const toggleFollow = async () => {
    if (!user || !profileUser || isOwnProfile) return;
    setFollowLoading(true);

    if (isFollowing) {
      const { error } = await (supabase as any)
        .from("user_follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profileUser.id);
      setFollowLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setIsFollowing(false);
      setSocialStats((current) => ({ ...current, followers: Math.max(0, current.followers - 1) }));
      toast.success("Unfollowed.");
      return;
    }

    const { error } = await (supabase as any)
      .from("user_follows")
      .insert({ follower_id: user.id, following_id: profileUser.id });
    setFollowLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setIsFollowing(true);
    setSocialStats((current) => ({ ...current, followers: current.followers + 1 }));
    await supabase.from("notifications").insert({
      user_id: profileUser.id,
      title: "New follower",
      message: `${user.email} started following you.`,
    });
    toast.success(`Following ${profileUser.full_name || profileUser.username || "builder"}.`);
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    update("avatar_url", data.publicUrl);
    toast.success("Avatar uploaded. Save your profile to keep it.");
  };

  const save = async () => {
    if (!user) return false;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: form.full_name || null,
      username: form.username || null,
      bio: form.bio || null,
      college: form.college || null,
      skills,
      role: form.role || null,
      github_url: form.github_url || null,
      linkedin_url: form.linkedin_url || null,
      portfolio_url: form.portfolio_url || null,
      avatar_url: form.avatar_url || null,
      profile_completed: completion >= 75,
    } as never, { onConflict: "id" });
    await (supabase as any).from("activity_history").insert({
      user_id: user.id,
      action: "profile_updated",
      details: "Updated profile information",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    localStorage.removeItem(DRAFT_KEY);
    const nextProfile = { ...profileUser, ...form, id: user.id } as Profile;
    setProfileUser(nextProfile);
    toast.success("Profile updated.");
    // notify auth hook to refresh profile across the app without a full reload
    window.dispatchEvent(new Event("profile_updated"));
    if (nextProfile.username && routeUsername !== nextProfile.username) {
      navigate({ to: "/profile/$username", params: { username: nextProfile.username }, replace: true });
    }
    return true;
  };

  const unfollowProfile = async (profileId: string) => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from("user_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", profileId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFollowingProfiles((current) => current.filter((item) => item.id !== profileId));
    setSocialStats((current) => ({ ...current, following: Math.max(0, current.following - 1) }));
    toast.success("Unfollowed.");
  };

  const deleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    const { error } = await (supabase as any).rpc("delete_current_user");
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    localStorage.removeItem(DRAFT_KEY);
    await supabase.auth.signOut();
    toast.success("Account deleted.");
    navigate({ to: "/" });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out.");
    navigate({ to: "/" });
  };

  if (profileLoading) {
    return (
      <section className="profile-card p-8 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-700 dark:text-cyan-300" />
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading profile...</p>
      </section>
    );
  }

  if (profileNotFound || !profileUser) {
    return (
      <section className="profile-card p-10 text-center">
        <h1 className="text-xl font-bold text-slate-950 dark:text-slate-50">Profile not found</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This SyncUp username does not match an existing profile.</p>
        <Link to="/dashboard" className="mt-5 inline-flex rounded-full bg-cyan-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-800 dark:bg-cyan-300 dark:text-slate-950">
          Back to home
        </Link>
      </section>
    );
  }

  return (
    <div className="profile-page mx-auto grid max-w-[1160px] gap-6 lg:grid-cols-[minmax(0,760px)_300px]">
      <main className="min-w-0 space-y-5">
        <section className="profile-card p-0 shadow-sm">
          <div className="px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="mx-auto shrink-0 sm:mx-0">
                <div className="rounded-full bg-white p-1.5 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                  <SafeAvatar profile={form as Profile} fallback={user?.email} className="h-24 w-24 text-3xl sm:h-28 sm:w-28" />
                </div>
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h1 className="break-words text-2xl font-bold leading-tight tracking-tight text-slate-950 dark:text-slate-50 sm:text-[28px]">{displayName}</h1>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-700 dark:text-slate-300">{headline}</p>
                    <p className="mt-2 inline-flex max-w-full items-center justify-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-sm text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 sm:justify-start">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span className="min-w-0 break-words">{locationLine}</span>
                    </p>
                  </div>
                </div>

                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">{aboutText}</p>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {isOwnProfile ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditOpen(true)}
                        className="profile-primary-button inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-sm transition"
                      >
                        <Edit3 className="h-4 w-4 shrink-0" />
                        <span>Edit Profile</span>
                      </button>
                      <button type="button" onClick={openShareModal} className="profile-secondary-button justify-center"><Share2 className="h-4 w-4" /> Share Profile</button>
                      <button
                        type="button"
                        onClick={logout}
                        className="profile-secondary-button justify-center text-red-700 hover:border-red-200 hover:bg-red-50 hover:text-red-800 dark:text-red-200 dark:hover:border-red-900 dark:hover:bg-red-950/30"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={toggleFollow}
                        disabled={followLoading}
                        className="profile-primary-button inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:opacity-60"
                      >
                        {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                        {followLoading ? "Saving..." : isFollowing ? "Following" : "Connect"}
                      </button>
                      <Link to="/messages" search={{ direct: profileUser.id } as never} className="profile-secondary-button justify-center"><MessageSquare className="h-4 w-4" /> Message</Link>
                      <button type="button" onClick={openShareModal} className="profile-secondary-button justify-center"><Share2 className="h-4 w-4" /> Share Profile</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="profile-card p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <ProfileMetric icon={Grid3X3} label="Posts" value={profilePosts.length} />
            <ProfileMetric icon={UserPlus} label="Followers" value={socialStats.followers} onClick={() => setListMode("followers")} />
            <ProfileMetric icon={UserCheck} label="Following" value={socialStats.following} onClick={() => setListMode("following")} />
            <ProfileMetric icon={Users} label="Teams" value={socialStats.teams} onClick={() => setListMode("teams")} />
            <ProfileMetric icon={Briefcase} label="Projects" value={projectTeams.length} />
          </div>
        </section>

        <section className="profile-card p-5">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">About</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">{aboutText}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoTile label="Current focus" value={headline} />
            <InfoTile label="College / Department" value={locationLine} />
          </div>
        </section>

        <section className="profile-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Skills</h2>
            {isOwnProfile && (
              <button type="button" onClick={() => setEditOpen(true)} className="rounded-full border border-cyan-200 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-300 dark:hover:bg-cyan-300/10">
                + Add Skill
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(skills.length ? skills : ["React", "Java", "Firebase", "UI/UX", "Hackathons", "Team Leadership", "Research"]).map((skill) => (
              <span key={skill} className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-sm font-semibold text-cyan-800 dark:border-cyan-800 dark:bg-cyan-300/10 dark:text-cyan-200">
                {skill}
              </span>
            ))}
          </div>
        </section>

        <section className="profile-card overflow-hidden p-0">
          <div className="flex overflow-x-auto border-b border-slate-200 px-2 dark:border-slate-700">
            {(["posts", "projects", "teams", "achievements", "activity"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold capitalize transition ${
                  activeTab === tab
                    ? "border-cyan-700 text-cyan-700 dark:border-cyan-300 dark:text-cyan-300"
                    : "border-transparent text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="p-5">
            <ProfileTabContent
              activeTab={activeTab}
              form={form}
              userEmail={user?.email}
              displayName={displayName}
              teams={teams}
              projectTeams={projectTeams}
              posts={profilePosts}
            />
          </div>
        </section>

      </main>

      <aside className="space-y-5 lg:sticky lg:top-24">
        <ProfileCompletionCard completion={completion} skills={skills} form={form} />
        <ProfileSidebar
          profile={form}
          socialStats={socialStats}
          followers={followers}
          followingProfiles={followingProfiles}
          onFollowers={() => setListMode("followers")}
          onFollowing={() => setListMode("following")}
        />
      </aside>

      {editOpen && isOwnProfile && (
        <div className="fixed inset-0 z-[92] flex items-end justify-center bg-black/55 px-0 backdrop-blur-sm sm:items-center sm:px-4">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="max-h-[92vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-w-3xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Edit profile</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Update your SyncUp builder identity.</p>
              </div>
              <button type="button" onClick={() => setEditOpen(false)} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-5">
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <SafeAvatar profile={form as Profile} fallback={user?.email} className="h-16 w-16 text-lg" />
                <div>
                  <p className="font-bold text-slate-950 dark:text-slate-50">{displayName}</p>
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-700 dark:bg-slate-900 dark:text-cyan-300 dark:hover:bg-cyan-300/10">
                    <Camera className="h-4 w-4" />
                    Change avatar
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && uploadAvatar(event.target.files[0])} />
                  </label>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Full name" value={form.full_name ?? ""} onChange={(value) => update("full_name", value)} />
                <Field label="Username" value={form.username ?? ""} onChange={(value) => update("username", value)} />
                <Field label="College" value={form.college ?? ""} onChange={(value) => update("college", value)} />
                <Field label="Role" value={form.role ?? ""} onChange={(value) => update("role", value)} />
                <Field label="GitHub" icon={Github} value={form.github_url ?? ""} onChange={(value) => update("github_url", value)} />
                <Field label="LinkedIn" icon={Linkedin} value={form.linkedin_url ?? ""} onChange={(value) => update("linkedin_url", value)} />
                <Field label="Portfolio" icon={Globe} value={form.portfolio_url ?? ""} onChange={(value) => update("portfolio_url", value)} />
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bio</label>
                  <textarea
                    value={form.bio ?? ""}
                    onChange={(event) => update("bio", event.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-700 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-cyan-300"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Skills</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {skillOptions.map((skill) => {
                      const selected = skills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => update("skills", selected ? skills.filter((item) => item !== skill) : [...skills, skill])}
                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                            selected ? "border-cyan-600 bg-cyan-50 text-cyan-800 dark:border-cyan-300 dark:bg-cyan-300/10 dark:text-cyan-200" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 dark:border-slate-700">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const saved = await save();
                      if (saved) setEditOpen(false);
                    }}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 rounded-full bg-cyan-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-60 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Profile
                  </button>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
                  <p className="font-bold text-red-800 dark:text-red-200">Danger zone</p>
                  <p className="mt-1 text-sm text-red-700/80 dark:text-red-200/70">Delete your account only if you are sure. This action cannot be undone.</p>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="mt-3 flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {shareOpen && (
        <div className="fixed inset-0 z-[94] flex items-end justify-center bg-black/55 px-0 backdrop-blur-sm sm:items-center sm:px-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Share your profile</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Send your SyncUp profile using your username link.</p>
              </div>
              <button type="button" onClick={() => setShareOpen(false)} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
              <input
                readOnly
                value={profileShareLink}
                className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-700 outline-none dark:text-slate-200"
              />
              <button
                type="button"
                onClick={copyProfileLink}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-cyan-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-cyan-800 dark:bg-cyan-300 dark:text-slate-950"
              >
                {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {linkCopied ? "Link copied" : "Copy Link"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {shareTargets.map((target) => (
                <a
                  key={target.label}
                  href={target.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:bg-cyan-300/10 dark:hover:text-cyan-300"
                >
                  {target.label}
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {listMode && (
        <SocialListModal
          mode={listMode}
          teams={teams}
          followers={followers}
          following={followingProfiles}
          onUnfollow={unfollowProfile}
          onClose={() => setListMode(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="glass-strong neon-border w-full max-w-md rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-100">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold">Delete account?</h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  This removes your SyncUp account and related profile data. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={() => setDeleteConfirm(false)} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/75 hover:bg-white/10">
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete account
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ProfileMetric({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <Icon className="mx-auto h-4 w-4 text-cyan-700 dark:text-cyan-300" />
      <p className="mt-2 text-xl font-bold text-slate-950 dark:text-slate-50">{value}</p>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="rounded-xl p-3 text-center transition hover:bg-slate-50 dark:hover:bg-slate-800">
        {content}
      </button>
    );
  }

  return <div className="rounded-xl p-3 text-center transition hover:bg-slate-50 dark:hover:bg-slate-800">{content}</div>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function ProfileCompletionCard({ completion, skills, form }: { completion: number; skills: string[]; form: Partial<Profile> }) {
  const suggestions = [
    !skills.length ? "Add skills" : null,
    !form.portfolio_url ? "Add portfolio link" : null,
    !form.bio ? "Add a short bio" : null,
  ].filter(Boolean);

  return (
    <section className="profile-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-slate-950 dark:text-slate-50">Profile strength</h2>
        <span className="text-sm font-bold text-cyan-700 dark:text-cyan-300">{completion}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <motion.div animate={{ width: `${completion}%` }} className="h-full rounded-full bg-cyan-700 dark:bg-cyan-300" />
      </div>
      <div className="mt-4 space-y-2">
        {(suggestions.length ? suggestions : ["Profile looks strong"]).map((item) => (
          <p key={item} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {item}
          </p>
        ))}
      </div>
    </section>
  );
}

function ProfileTabContent({
  activeTab,
  form,
  userEmail,
  displayName,
  teams,
  projectTeams,
  posts,
}: {
  activeTab: ProfileTab;
  form: Partial<Profile>;
  userEmail?: string | null;
  displayName: string;
  teams: TeamSummary[];
  projectTeams: TeamSummary[];
  posts: ProfilePost[];
}) {
  if (activeTab === "projects") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {(projectTeams.length ? projectTeams : teams).length ? (projectTeams.length ? projectTeams : teams).map((team) => (
          <ProjectCard key={team.id} team={team} />
        )) : (
          <EmptyState icon={Briefcase} title="No projects yet" detail="Projects will appear as you join or create project teams." />
        )}
      </div>
    );
  }

  if (activeTab === "teams") {
    return teams.length ? (
      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team) => <ProjectCard key={team.id} team={team} />)}
      </div>
    ) : <EmptyState icon={Users} title="No teams yet" detail="Join or create a team to build your SyncUp presence." />;
  }

  if (activeTab === "achievements") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <AchievementCard title="Builder profile created" detail="Your SyncUp professional identity is ready." icon={Award} />
        <AchievementCard title="Reliability score" detail={`${form.reliability_score ?? 100}% community reliability`} icon={ShieldCheck} />
      </div>
    );
  }

  if (activeTab === "activity") {
    return (
      <div className="space-y-3">
        <ActivityItem title="Profile updated" detail="Keeping your builder profile fresh improves discovery." />
        {teams.slice(0, 3).map((team) => (
          <ActivityItem key={team.id} title={`Joined ${team.team_name}`} detail={team.project_title || team.team_purpose || "Team workspace"} />
        ))}
      </div>
    );
  }

  return posts.length ? (
    <div className="space-y-4">
      {posts.map((post) => (
        <ProfilePostCard
          key={post.id}
          post={post}
          fallbackProfile={form}
          userEmail={userEmail}
          displayName={displayName}
        />
      ))}
    </div>
  ) : (
    <EmptyState icon={Grid3X3} title="No posts yet" detail="Your SyncUp posts will appear here with likes, comments, shares, and saves." />
  );
}

function ProfilePostCard({
  post,
  fallbackProfile,
  userEmail,
  displayName,
}: {
  post: ProfilePost;
  fallbackProfile: Partial<Profile>;
  userEmail?: string | null;
  displayName: string;
}) {
  const profile = post.profile ?? fallbackProfile;
  const likeCount = getLikeCount(post);
  const commentCount = getCommentCount(post);
  const shareCount = getShareCount(post);
  const [openPanel, setOpenPanel] = useState<"likes" | "comments" | null>(null);
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const togglePanel = (panel: "likes" | "comments") => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  return (
    <article className="rounded-2xl border border-slate-200 p-4 transition hover:shadow-md dark:border-slate-700">
      <div className="flex items-start gap-3">
        <SafeAvatar profile={profile as Profile} fallback={userEmail} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-950 dark:text-slate-50">{profile.full_name || displayName}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {profile.role || "Builder"} · {timeAgo(post.created_at)}
          </p>
        </div>
      </div>
      <PostBody content={post.content} />
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <PostAction icon={Heart} label={`Like ${likeCount}`} onClick={() => togglePanel("likes")} active={openPanel === "likes"} />
        <PostAction icon={MessageSquare} label={`Comment ${commentCount}`} onClick={() => togglePanel("comments")} active={openPanel === "comments"} />
        <PostAction icon={Share2} label={`Share ${shareCount}`} />
        <PostAction icon={Bookmark} label="Save" />
      </div>
      {openPanel === "likes" && (
        <EngagementPanel
          emptyText="No likes yet."
          items={likes}
          renderItem={(like) => <EngagementPerson profile={like.profile} fallback="SyncUp user" />}
        />
      )}
      {openPanel === "comments" && (
        <EngagementPanel
          emptyText="No comments yet."
          items={comments}
          renderItem={(comment) => (
            <div className="flex gap-3">
              <EngagementAvatar profile={comment.profile} fallback="SyncUp user" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{comment.profile?.full_name || comment.profile?.username || "SyncUp user"}</p>
                  <p className="text-xs text-slate-400">{timeAgo(comment.created_at)}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-400">{comment.content}</p>
              </div>
            </div>
          )}
        />
      )}
    </article>
  );
}

function EngagementPanel<T>({ items, emptyText, renderItem }: { items: T[]; emptyText: string; renderItem: (item: T) => ReactNode }) {
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
      {items.length ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index}>{renderItem(item)}</div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

function EngagementPerson({ profile, fallback }: { profile?: Profile | null; fallback: string }) {
  return (
    <div className="flex items-center gap-3">
      <EngagementAvatar profile={profile} fallback={fallback} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{profile?.full_name || profile?.username || fallback}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile?.role || "Builder"}</p>
      </div>
    </div>
  );
}

function EngagementAvatar({ profile, fallback }: { profile?: Profile | null; fallback: string }) {
  return <SafeAvatar profile={profile} fallback={fallback} className="h-9 w-9 text-xs" />;
}

function PostBody({ content }: { content: string }) {
  const parts = content.split(/(#[\w-]+)/g);
  return (
    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-400">
      {parts.map((part, index) => (
        part.startsWith("#")
          ? <span key={`${part}-${index}`} className="font-semibold text-cyan-700 dark:text-cyan-300">{part}</span>
          : <span key={`${part}-${index}`}>{part}</span>
      ))}
    </p>
  );
}

function getLikeCount(post: ProfilePost) {
  if (Array.isArray(post.likes)) return post.likes.length;
  return post.likeCount ?? post.likesCount ?? (typeof post.likes === "number" ? post.likes : 0);
}

function getCommentCount(post: ProfilePost) {
  if (Array.isArray(post.comments)) return post.comments.length;
  return post.commentCount ?? post.commentsCount ?? (typeof post.comments === "number" ? post.comments : 0);
}

function getShareCount(post: ProfilePost) {
  if (Array.isArray(post.shares)) return post.shares.length;
  return post.shareCount ?? post.sharesCount ?? (typeof post.shares === "number" ? post.shares : 0);
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

function ProjectCard({ team }: { team: TeamSummary }) {
  return (
    <Link to="/teams/$id" params={{ id: team.id }} className="block rounded-2xl border border-slate-200 p-4 transition hover:border-cyan-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-cyan-700 dark:hover:bg-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-950 dark:text-slate-50">{team.project_title || team.team_name}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{team.team_name}</p>
        </div>
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-300">
          {team.team_purpose || "Project"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">Collaborative workspace with builders, milestones, and team updates.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["React", "Research", "Teamwork"].map((item) => (
          <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{item}</span>
        ))}
      </div>
    </Link>
  );
}

function AchievementCard({ title, detail, icon: Icon }: { title: string; detail: string; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <Icon className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
      <p className="mt-3 font-bold text-slate-950 dark:text-slate-50">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function ActivityItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-300">
        <Activity className="h-5 w-5" />
      </span>
      <div>
        <p className="font-bold text-slate-950 dark:text-slate-50">{title}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function PostAction({ icon: Icon, label, onClick, active = false }: { icon: LucideIcon; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-300"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function EmptyState({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return (
    <div className="sm:col-span-2 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
      <Icon className="mx-auto h-8 w-8 text-slate-400" />
      <p className="mt-3 font-bold text-slate-950 dark:text-slate-50">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function ProfileSidebar({
  profile,
  socialStats,
  followers,
  followingProfiles,
  onFollowers,
  onFollowing,
}: {
  profile: Partial<Profile>;
  socialStats: { teams: number; followers: number; following: number };
  followers: Profile[];
  followingProfiles: Profile[];
  onFollowers: () => void;
  onFollowing: () => void;
}) {
  return (
    <>
      <section className="profile-card p-4">
        <h2 className="font-bold text-slate-950 dark:text-slate-50">Suggested builders</h2>
        <div className="mt-3 space-y-3">
          {[...followers, ...followingProfiles].slice(0, 3).map((person) => (
            <Link key={person.id} to="/profile/$username" params={{ username: person.username || person.id }} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50 dark:hover:bg-slate-800">
              <SafeAvatar profile={person} className="h-10 w-10 text-xs" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{person.full_name || person.username || "SyncUp user"}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{person.role || "Builder"}</span>
              </span>
            </Link>
          ))}
          {!followers.length && !followingProfiles.length && <p className="text-sm text-slate-500 dark:text-slate-400">Connect with builders to see suggestions here.</p>}
        </div>
      </section>

      <section className="profile-card p-4">
        <h2 className="font-bold text-slate-950 dark:text-slate-50">Portfolio links</h2>
        <div className="mt-3 space-y-2">
          <ProfileLink href={profile.github_url} icon={Github} label="GitHub" />
          <ProfileLink href={profile.linkedin_url} icon={Linkedin} label="LinkedIn" />
          <ProfileLink href={profile.portfolio_url} icon={Globe} label="Portfolio" />
        </div>
      </section>

      <section className="profile-card p-4">
        <h2 className="font-bold text-slate-950 dark:text-slate-50">Network</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onFollowers} className="rounded-xl bg-slate-50 p-3 text-left transition hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700">
            <p className="text-lg font-bold text-slate-950 dark:text-slate-50">{socialStats.followers}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Followers</p>
          </button>
          <button type="button" onClick={onFollowing} className="rounded-xl bg-slate-50 p-3 text-left transition hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700">
            <p className="text-lg font-bold text-slate-950 dark:text-slate-50">{socialStats.following}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Following</p>
          </button>
        </div>
      </section>
    </>
  );
}

function ProfileLink({ href, icon: Icon, label }: { href?: string | null; icon: LucideIcon; label: string }) {
  if (!href) {
    return <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:bg-slate-800 dark:text-slate-500">{label} not added</p>;
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-300/10">
      <Icon className="h-4 w-4" />
      {label}
    </a>
  );
}

function Field({
  label,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: LucideIcon;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</label>
      <div className="relative mt-1">
        {Icon && <Icon className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-700 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-cyan-300 ${Icon ? "pl-10" : ""}`}
        />
      </div>
    </div>
  );
}

function SocialListModal({
  mode,
  teams,
  followers,
  following,
  onUnfollow,
  onClose,
}: {
  mode: SocialListMode;
  teams: TeamSummary[];
  followers: Profile[];
  following: Profile[];
  onUnfollow?: (profileId: string) => void;
  onClose: () => void;
}) {
  const title = mode === "teams" ? "Teams" : mode === "followers" ? "Followers" : "Following";
  const people = mode === "followers" ? followers : following;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="glass-strong neon-border max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-white/60 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 max-h-[65vh] space-y-3 overflow-y-auto">
          {mode === "teams" ? (
            teams.length ? teams.map((team) => (
              <Link
                key={team.id}
                to="/teams/$id"
                params={{ id: team.id }}
                onClick={onClose}
                className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
              >
                <p className="font-semibold">{team.team_name}</p>
                <p className="mt-1 text-sm text-cyan-100/70">{team.project_title || "Project pending"}</p>
                <p className="mt-2 text-xs text-white/45">{team.team_purpose || "Team workspace"}</p>
              </Link>
            )) : (
              <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-white/50">No teams yet.</p>
            )
          ) : people.length ? people.map((person) => (
            <div key={person.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
              <Link
                to="/profile/$username"
                params={{ username: person.username || person.id }}
                onClick={onClose}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <SafeAvatar profile={person} className="h-12 w-12" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{person.full_name || person.username || "SyncUp user"}</p>
                  <p className="truncate text-xs text-white/50">@{person.username || "profile"} - {person.role || "Builder"}</p>
                </div>
              </Link>
              {mode === "following" && onUnfollow && (
                <button
                  onClick={() => onUnfollow(person.id)}
                  className="shrink-0 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15"
                >
                  Unfollow
                </button>
              )}
            </div>
          )) : (
            <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-white/50">
              No {mode} yet.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
