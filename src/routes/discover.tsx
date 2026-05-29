import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bookmark, Loader2, MailPlus, Search, Send, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { supabase } from "@/integrations/supabase/client";
import { Profile, initials } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/discover")({
  head: () => ({ meta: [{ title: "Discover Teams & Profiles | SyncUp" }] }),
  component: DiscoverRoute,
});

type Team = {
  id: string;
  team_name: string;
  team_purpose?: string | null;
  target_name?: string | null;
  project_title: string | null;
  description: string | null;
  required_skills: string[] | null;
  max_members: number | null;
  leader_id: string;
  created_at: string;
};

function DiscoverRoute() {
  return (
    <ProtectedPage>
      <PlatformShell>
        <DiscoverPage />
      </PlatformShell>
    </ProtectedPage>
  );
}

function DiscoverPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestTeam, setRequestTeam] = useState<Team | null>(null);
  const [savedTeamIds, setSavedTeamIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const normalized = query.trim();

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);

      let teamQuery = supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(24);
      let profileQuery = supabase
        .from("profiles")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(24);

      if (normalized) {
        teamQuery = teamQuery.or(
          `team_name.ilike.%${normalized}%,project_title.ilike.%${normalized}%,description.ilike.%${normalized}%,target_name.ilike.%${normalized}%`,
        );
        profileQuery = profileQuery.or(
          `full_name.ilike.%${normalized}%,username.ilike.%${normalized}%,college.ilike.%${normalized}%,bio.ilike.%${normalized}%`,
        );
      }

      const [teamResult, profileResult] = await Promise.all([teamQuery, profileQuery]);
      if (teamResult.error) toast.error(teamResult.error.message);
      if (profileResult.error) toast.error(profileResult.error.message);

      setTeams((teamResult.data as Team[]) ?? []);
      setProfiles(((profileResult.data as Profile[]) ?? []).filter((profile) => profile.id !== user?.id));
      if (user) {
        const saved = await (supabase as any).from("saved_teams").select("team_id").eq("user_id", user.id);
        setSavedTeamIds(((saved.data as Array<{ team_id: string }>) ?? []).map((item) => item.team_id));
      }
      setLoading(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [normalized, user?.id]);

  const filteredProfiles = useMemo(() => {
    if (!normalized) return profiles;
    const lower = normalized.toLowerCase();
    return profiles.filter((profile) => {
      return [
        profile.full_name,
        profile.username,
        profile.college,
        profile.bio,
        profile.role,
        ...(profile.skills ?? []),
      ]
        .filter(Boolean)
        .some((value) => `${value}`.toLowerCase().includes(lower));
    });
  }, [normalized, profiles]);

  const sendJoinRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !requestTeam) return;
    if (requestTeam.leader_id === user.id) {
      toast.error("You already lead this team.");
      return;
    }

    setSending(true);
    const { error } = await supabase.from("join_requests").insert({
      user_id: user.id,
      team_id: requestTeam.id,
      message: message.trim() || null,
      status: "pending",
    });

    if (!error) {
      await supabase.from("notifications").insert({
        user_id: requestTeam.leader_id,
        title: "New join request",
        message: `${user.email} requested to join ${requestTeam.team_name}`,
      });
      await (supabase as any).from("activity_history").insert({
        user_id: user.id,
        action: "join_request_sent",
        details: `Requested to join ${requestTeam.team_name}`,
        metadata: { team_id: requestTeam.id },
      });
    }

    setSending(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "You already sent a request to this team." : error.message);
      return;
    }
    toast.success("Join request sent.");
    setRequestTeam(null);
    setMessage("");
  };

  const toggleSaveTeam = async (team: Team) => {
    if (!user) return;
    if (savedTeamIds.includes(team.id)) {
      await (supabase as any).from("saved_teams").delete().eq("user_id", user.id).eq("team_id", team.id);
      setSavedTeamIds((current) => current.filter((id) => id !== team.id));
      toast.success("Team removed from saved.");
      return;
    }

    const { error } = await (supabase as any).from("saved_teams").insert({ user_id: user.id, team_id: team.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavedTeamIds((current) => [...current, team.id]);
    toast.success("Team saved.");
  };

  return (
    <section className="space-y-6">
      <div className="glass-strong neon-border rounded-2xl p-6">
        <h1 className="text-3xl font-bold">Discover teams and builders</h1>
        <p className="mt-2 text-white/55">Search by team name, project, purpose, skill, college, or profile bio.</p>
        <div className="relative mt-6">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-white/40" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 pl-12 text-sm outline-none transition focus:border-cyan-300"
            placeholder="Search teams, AI/ML, patent, designer, college..."
          />
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center rounded-2xl bg-white/5 p-12">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="glass-strong rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><Users className="h-5 w-5 text-cyan-300" /> Teams</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {teams.length ? teams.map((team) => (
                <motion.article key={team.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to="/teams/$id" params={{ id: team.id }} className="text-lg font-semibold hover:text-cyan-200">
                        {team.team_name}
                      </Link>
                      <p className="text-sm text-cyan-100/75">{team.project_title || "Project title pending"}</p>
                    </div>
                    <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs text-cyan-100">{team.team_purpose || "Team"}</span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm text-white/55">{team.description || "No description added."}</p>
                  {team.target_name && <p className="mt-3 text-xs text-white/45">Target: {team.target_name}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(team.required_skills ?? []).slice(0, 6).map((skill) => (
                      <span key={skill} className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/70">{skill}</span>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <button
                      onClick={() => setRequestTeam(team)}
                      disabled={team.leader_id === user?.id}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MailPlus className="h-4 w-4" />
                      {team.leader_id === user?.id ? "Your team" : "Request to join"}
                    </button>
                    <button
                      onClick={() => toggleSaveTeam(team)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/10"
                    >
                      <Bookmark className={`h-4 w-4 ${savedTeamIds.includes(team.id) ? "fill-current" : ""}`} />
                      {savedTeamIds.includes(team.id) ? "Saved" : "Save"}
                    </button>
                  </div>
                </motion.article>
              )) : (
                <p className="md:col-span-2 rounded-2xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white/55">No teams found.</p>
              )}
            </div>
          </section>

          <section className="glass-strong rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><UserPlus className="h-5 w-5 text-cyan-300" /> Profiles</h2>
            <div className="mt-5 space-y-3">
              {filteredProfiles.length ? filteredProfiles.map((profile) => (
                <div key={profile.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Link to="/profiles/$id" params={{ id: profile.id }} className="flex items-center gap-3 rounded-xl transition hover:bg-white/5">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="h-11 w-11 rounded-xl object-cover" />
                    ) : (
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 font-bold">
                        {initials(profile)}
                      </span>
                    )}
                    <div>
                      <p className="font-semibold">{profile.full_name || profile.username || "SyncUp user"}</p>
                      <p className="text-sm text-white/50">@{profile.username || "profile"} · {profile.role || "Builder"}</p>
                    </div>
                  </Link>
                  <p className="mt-3 line-clamp-2 text-sm text-white/55">{profile.bio || profile.college || "No profile bio yet."}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(profile.skills ?? []).slice(0, 5).map((skill) => (
                      <span key={skill} className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/70">{skill}</span>
                    ))}
                  </div>
                </div>
              )) : (
                <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white/55">No profiles found.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {requestTeam && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <motion.form
            onSubmit={sendJoinRequest}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="glass-strong neon-border w-full max-w-lg rounded-2xl p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Request to join</h2>
                <p className="mt-1 text-sm text-white/55">{requestTeam.team_name}</p>
              </div>
              <button type="button" onClick={() => setRequestTeam(null)} className="rounded-xl p-2 text-white/60 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mt-5 block text-xs text-white/60">Message to team leader</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
              placeholder="Tell them what you can contribute, your skills, and why you want to join."
            />
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setRequestTeam(null)} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/70">
                Cancel
              </button>
              <button disabled={sending} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold disabled:opacity-60">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send request
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </section>
  );
}
