import { createFileRoute, Link } from "@tanstack/react-router";
import { Github, Globe, Linkedin, MessageSquare, Send, ShieldCheck, Trophy, UserPlus, UserCheck, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { supabase } from "@/integrations/supabase/client";
import { Profile, initials, profileCompletion } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

type TeamSummary = {
  id: string;
  team_name: string;
  team_purpose?: string | null;
  project_title: string | null;
  leader_id: string;
};

type SocialListMode = "teams" | "followers" | "following";

export const Route = createFileRoute("/profiles/$id")({
  head: () => ({ meta: [{ title: "Profile | SyncUp" }] }),
  component: ProfileDetailRoute,
});

function ProfileDetailRoute() {
  return (
    <ProtectedPage>
      <PlatformShell>
        <ProfileDetail />
      </PlatformShell>
    </ProtectedPage>
  );
}

function ProfileDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ teams: 0, requests: 0, followers: 0, following: 0 });
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<Profile[]>([]);
  const [listMode, setListMode] = useState<SocialListMode | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [posts, setPosts] = useState<Array<{ id: string; content: string; created_at: string }>>([]);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; sender_id: string; message: string; created_at: string }>>([]);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", id).maybeSingle().then(({ data }) => setProfile((data as Profile) ?? null));
    Promise.all([
      supabase.from("team_members").select("team_id").eq("user_id", id),
      supabase.from("join_requests").select("*", { count: "exact", head: true }).eq("user_id", id),
      (supabase as any).from("user_follows").select("follower_id").eq("following_id", id),
      (supabase as any).from("user_follows").select("following_id").eq("follower_id", id),
      (supabase as any).from("posts").select("id, content, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
      user?.id && user.id !== id
        ? (supabase as any).from("user_follows").select("id").eq("follower_id", user.id).eq("following_id", id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(async ([memberships, requests, followerRows, followingRows, postRows, followRow]) => {
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
      setStats({
        teams: teamIds.length,
        requests: requests.count ?? 0,
        followers: followerIds.length,
        following: followingIds.length,
      });
      setPosts((postRows.data as Array<{ id: string; content: string; created_at: string }>) ?? []);
      setIsFollowing(Boolean(followRow.data));
    });
  }, [id, user?.id]);

  if (!profile) {
    return (
      <section className="glass-strong rounded-2xl p-10 text-center text-white/60">
        Profile not found.
      </section>
    );
  }

  const completion = profileCompletion(profile);

  const toggleFollow = async () => {
    if (!user || user.id === id) return;
    setFollowLoading(true);

    if (isFollowing) {
      const { error } = await (supabase as any)
        .from("user_follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", id);
      setFollowLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setIsFollowing(false);
      setStats((current) => ({ ...current, followers: Math.max(0, current.followers - 1) }));
      toast.success("Unfollowed.");
      return;
    }

    const { error } = await (supabase as any)
      .from("user_follows")
      .insert({ follower_id: user.id, following_id: id });
    setFollowLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setIsFollowing(true);
    setStats((current) => ({ ...current, followers: current.followers + 1 }));
    await supabase.from("notifications").insert({
      user_id: id,
      title: "New follower",
      message: `${user.email} started following you.`,
    });
    toast.success(`Following ${profile.full_name || profile.username || "user"}.`);
  };

  const openMessages = async () => {
    setMessageOpen(true);
    if (!user) return;
    const { data } = await (supabase as any)
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${id}),and(sender_id.eq.${id},recipient_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !message.trim()) return;
    const text = message.trim();
    setMessage("");
    const { data, error } = await (supabase as any)
      .from("direct_messages")
      .insert({ sender_id: user.id, recipient_id: id, message: text })
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      setMessage(text);
      return;
    }
    setMessages((current) => [...current, data]);
    await supabase.from("notifications").insert({
      user_id: id,
      title: "New profile message",
      message: `${user.email} sent you a message.`,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="glass-strong neon-border rounded-2xl p-6 text-center">
        <Link
          to="/profiles/$id"
          params={{ id }}
          className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-3xl font-bold ring-2 ring-cyan-300/40 transition hover:scale-105"
          title="Open profile"
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(profile)
          )}
        </Link>
        <h1 className="mt-5 text-3xl font-bold">{profile.full_name || profile.username || "SyncUp user"}</h1>
        <p className="text-cyan-200">@{profile.username || "profile"} · {profile.role || "Builder"}</p>
        <p className="mt-4 text-sm text-white/60">{profile.bio || "This builder has not added a bio yet."}</p>
        <p className="mt-3 text-sm text-white/45">{profile.college || "College not added"}</p>

        {user?.id !== id && (
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              onClick={toggleFollow}
              disabled={followLoading}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60 ${
                isFollowing
                  ? "border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15"
                  : "bg-gradient-to-r from-blue-500 to-purple-500"
              }`}
            >
              {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {followLoading ? "Saving..." : isFollowing ? "Following" : "Follow"}
            </button>
            <Link to="/messages" search={{ direct: id } as never} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" />
              Open chat
            </Link>
            <button onClick={openMessages} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/75 hover:bg-white/10">
              <Send className="h-4 w-4" />
              Quick message
            </button>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={ShieldCheck} label="Reliability" value={profile.reliability_score ?? 100} />
          <Stat icon={Users} label="Teams" value={stats.teams} onClick={() => setListMode("teams")} />
          <Stat icon={UserPlus} label="Followers" value={stats.followers} onClick={() => setListMode("followers")} />
          <Stat icon={UserCheck} label="Following" value={stats.following} onClick={() => setListMode("following")} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <Stat icon={Trophy} label="Profile" value={completion} suffix="%" />
        </div>
      </section>

      <section className="glass-strong rounded-2xl p-6">
        <h2 className="text-xl font-semibold">Builder details</h2>
        <div className="mt-5">
          <p className="text-sm text-white/50">Skills</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(profile.skills ?? []).length ? (profile.skills ?? []).map((skill) => (
              <span key={skill} className="rounded-full bg-cyan-300/15 px-3 py-1.5 text-xs text-cyan-100">{skill}</span>
            )) : <span className="text-sm text-white/45">No skills added.</span>}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Social href={profile.github_url} icon={Github} label="GitHub" />
          <Social href={profile.linkedin_url} icon={Linkedin} label="LinkedIn" />
          <Social href={profile.portfolio_url} icon={Globe} label="Portfolio" />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="font-semibold">Collaboration signal</h3>
          <p className="mt-2 text-sm text-white/55">
            {profile.full_name || profile.username || "This user"} has sent {stats.requests} join request{stats.requests === 1 ? "" : "s"} and is connected to {stats.teams} team{stats.teams === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold">Recent posts</h3>
          <div className="mt-3 space-y-3">
            {posts.length ? posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="whitespace-pre-wrap text-sm leading-6 text-white/70">{post.content}</p>
                <p className="mt-3 text-xs text-white/35">{new Date(post.created_at).toLocaleString()}</p>
              </article>
            )) : (
              <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-white/45">
                No posts from this builder yet.
              </p>
            )}
          </div>
        </div>
      </section>

      {messageOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="glass-strong neon-border flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  to="/profiles/$id"
                  params={{ id }}
                  className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 font-bold ring-1 ring-white/10 transition hover:scale-105"
                  title="Open profile"
                >
                  {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(profile)}
                </Link>
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-bold">Message {profile.full_name || profile.username || "user"}</h2>
                  <p className="mt-1 text-sm text-white/55">Direct profile messages</p>
                </div>
              </div>
              <button onClick={() => setMessageOpen(false)} className="rounded-xl p-2 text-white/60 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 min-h-64 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-black/20 p-4">
              {messages.length ? messages.map((item) => {
                const own = item.sender_id === user?.id;
                return (
                  <div key={item.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${own ? "bg-cyan-300/20 text-cyan-50" : "bg-white/8 text-white/75"}`}>
                      <p>{item.message}</p>
                      <p className="mt-1 text-[10px] text-white/35">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                );
              }) : <p className="grid h-40 place-items-center text-sm text-white/45">No messages yet.</p>}
            </div>
            <form onSubmit={sendMessage} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input value={message} onChange={(event) => setMessage(event.target.value)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-cyan-300" placeholder="Write a message..." />
              <button className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold">
                <Send className="h-4 w-4" />
                Send
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {listMode && (
        <SocialListModal
          mode={listMode}
          teams={teams}
          followers={followers}
          following={followingProfiles}
          onClose={() => setListMode(null)}
        />
      )}
    </div>
  );
}

function Social({ href, icon: Icon, label }: { href?: string | null; icon: typeof Github; label: string }) {
  if (!href) {
    return <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/35">{label} not added</div>;
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 hover:bg-white/10">
      <Icon className="h-4 w-4 text-cyan-300" />
      {label}
    </a>
  );
}

function Stat({ icon: Icon, label, value, suffix = "", onClick }: { icon: typeof ShieldCheck; label: string; value: number; suffix?: string; onClick?: () => void }) {
  const className = `rounded-xl bg-white/5 p-3 transition ${onClick ? "hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/40" : ""}`;
  const content = (
    <>
      <Icon className="mx-auto h-4 w-4 text-cyan-300" />
      <p className="mt-2 text-lg font-bold">{value}{suffix}</p>
      <p className="text-[11px] text-white/45">{label}</p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

function SocialListModal({
  mode,
  teams,
  followers,
  following,
  onClose,
}: {
  mode: SocialListMode;
  teams: TeamSummary[];
  followers: Profile[];
  following: Profile[];
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
            <Link
              key={person.id}
              to="/profiles/$id"
              params={{ id: person.id }}
              onClick={onClose}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
            >
              {person.avatar_url ? (
                <img src={person.avatar_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 font-bold">
                  {initials(person)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{person.full_name || person.username || "SyncUp user"}</p>
                <p className="truncate text-xs text-white/50">@{person.username || "profile"} · {person.role || "Builder"}</p>
              </div>
            </Link>
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
