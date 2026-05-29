import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/saved-competitions")({
  head: () => ({ meta: [{ title: "Saved | SyncUp" }] }),
  component: SavedRoute,
});

type SavedCompetition = {
  id: string;
  title: string | null;
  organizer: string | null;
  saved_at: string;
};

type SavedTeam = {
  id: string;
  team_id: string;
  saved_at: string;
  team?: {
    id: string;
    team_name: string;
    team_purpose: string | null;
    project_title: string | null;
    target_name: string | null;
  } | null;
};

function SavedRoute() {
  return (
    <ProtectedPage>
      <PlatformShell>
        <SavedItems />
      </PlatformShell>
    </ProtectedPage>
  );
}

function SavedItems() {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<SavedCompetition[]>([]);
  const [teams, setTeams] = useState<SavedTeam[]>([]);

  const loadSaved = async () => {
    if (!user) return;
    const [competitionRows, savedTeamRows] = await Promise.all([
      (supabase as any)
        .from("saved_competitions")
        .select("*")
        .eq("user_id", user.id)
        .order("saved_at", { ascending: false }),
      (supabase as any)
        .from("saved_teams")
        .select("id, team_id, saved_at")
        .eq("user_id", user.id)
        .order("saved_at", { ascending: false }),
    ]);

    const savedRows = (savedTeamRows.data as SavedTeam[]) ?? [];
    const teamIds = savedRows.map((item) => item.team_id);
    const teamRows = teamIds.length
      ? await supabase.from("teams").select("id, team_name, team_purpose, project_title, target_name").in("id", teamIds)
      : { data: [] };
    const teamMap = new Map(((teamRows.data as SavedTeam["team"][]) ?? []).filter(Boolean).map((team) => [team!.id, team]));

    setCompetitions((competitionRows.data as SavedCompetition[]) ?? []);
    setTeams(savedRows.map((item) => ({ ...item, team: teamMap.get(item.team_id) ?? null })));
  };

  useEffect(() => {
    loadSaved();
  }, [user?.id]);

  const removeSavedTeam = async (teamId: string) => {
    if (!user) return;
    await (supabase as any).from("saved_teams").delete().eq("user_id", user.id).eq("team_id", teamId);
    await loadSaved();
  };

  return (
    <section className="space-y-6">
      <div className="glass-strong neon-border rounded-2xl p-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold"><Bookmark className="h-7 w-7 text-cyan-300" /> Saved</h1>
        <p className="mt-2 text-white/55">Teams, hackathons, events, and innovation challenges you bookmarked.</p>
      </div>

      <section className="glass-strong rounded-2xl p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Users className="h-5 w-5 text-cyan-300" /> Saved Teams</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {teams.length ? teams.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-cyan-100">{item.team?.team_purpose || "Team"}</p>
              <Link to="/teams/$id" params={{ id: item.team_id }} className="mt-2 block text-lg font-semibold hover:text-cyan-200">
                {item.team?.team_name || "Saved team"}
              </Link>
              <p className="mt-1 text-sm text-white/55">{item.team?.project_title || item.team?.target_name || "Project details pending"}</p>
              <button onClick={() => removeSavedTeam(item.team_id)} className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/10">
                Remove
              </button>
            </article>
          )) : (
            <div className="md:col-span-2 rounded-2xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white/55">
              No saved teams yet.
            </div>
          )}
        </div>
      </section>

      <section className="glass-strong rounded-2xl p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Trophy className="h-5 w-5 text-cyan-300" /> Saved Competitions</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {competitions.length ? competitions.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <Trophy className="h-6 w-6 text-cyan-300" />
              <h3 className="mt-3 text-lg font-semibold">{item.title || "Saved competition"}</h3>
              <p className="text-sm text-white/50">{item.organizer || "Organizer pending"}</p>
            </div>
          )) : (
            <div className="md:col-span-2 rounded-2xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white/55">
              No saved competitions yet.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
