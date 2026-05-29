import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Lightbulb, Loader2, MessageSquare, Plus, Rocket, Save, Send, Trophy, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { notifyFollowers } from "@/lib/social";

export const Route = createFileRoute("/my-teams")({
  head: () => ({ meta: [{ title: "My Teams | SyncUp" }] }),
  component: MyTeamsRoute,
});

type Team = {
  id: string;
  team_name: string;
  team_purpose?: string | null;
  target_name?: string | null;
  target_url?: string | null;
  project_title: string | null;
  description: string | null;
  required_skills: string[] | null;
  max_members: number | null;
  leader_id: string;
  created_at: string;
};

type JoinRequest = {
  id: string;
  user_id: string;
  team_id: string;
  status: string;
  message: string | null;
  created_at: string;
  team?: Team;
  profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    skills: string[] | null;
  } | null;
};

type RequestMessage = {
  id: string;
  request_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

const skillOptions = ["React", "AI/ML", "UI/UX", "Python", "Backend", "Research", "Pitching", "Product", "IoT"];
const purposeOptions = ["Competition", "Patent / IP Rights", "Startup", "Research Paper", "Open Source", "College Project", "Other"];
const defaultTeamForm = {
  teamName: "",
  teamPurpose: "Competition",
  targetName: "",
  targetUrl: "",
  projectTitle: "",
  description: "",
  maxMembers: "4",
};

function readTeamDraft() {
  if (typeof window === "undefined") return { form: defaultTeamForm, skills: [] as string[], customSkill: "", open: false };

  try {
    const draft = JSON.parse(window.localStorage.getItem("syncup_team_draft") ?? "{}") as {
      form?: Partial<typeof defaultTeamForm>;
      skills?: string[];
      customSkill?: string;
      open?: boolean;
    };

    const form = { ...defaultTeamForm, ...(draft.form ?? {}) };
    const hasDraft = Object.entries(form).some(([key, value]) => value !== defaultTeamForm[key as keyof typeof defaultTeamForm])
      || Boolean(draft.skills?.length)
      || Boolean(draft.customSkill);

    return {
      form,
      skills: Array.isArray(draft.skills) ? draft.skills : [],
      customSkill: draft.customSkill ?? "",
      open: Boolean(draft.open || hasDraft),
    };
  } catch {
    return { form: defaultTeamForm, skills: [] as string[], customSkill: "", open: false };
  }
}

function MyTeamsRoute() {
  return (
    <ProtectedPage>
      <PlatformShell>
        <MyTeamsPage />
      </PlatformShell>
    </ProtectedPage>
  );
}

function MyTeamsPage() {
  const { user } = useAuth();
  const teamDraft = readTeamDraft();
  const [teams, setTeams] = useState<Team[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<JoinRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<JoinRequest[]>([]);
  const [messageRequest, setMessageRequest] = useState<JoinRequest | null>(null);
  const [requestMessages, setRequestMessages] = useState<RequestMessage[]>([]);
  const [threadText, setThreadText] = useState("");
  const [threadLoading, setThreadLoading] = useState(false);
  const [open, setOpen] = useState(teamDraft.open);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(teamDraft.form);
  const [customSkill, setCustomSkill] = useState(teamDraft.customSkill);
  const [skills, setSkills] = useState<string[]>(teamDraft.skills);

  const loadTeams = async () => {
    if (!user) return;
    setLoading(true);
    const memberships = await supabase.from("team_members").select("team_id").eq("user_id", user.id);
    const memberTeamIds = (memberships.data ?? []).map((row) => row.team_id);
    const conditions = [`leader_id.eq.${user.id}`, ...memberTeamIds.map((id) => `id.eq.${id}`)].join(",");

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .or(conditions)
      .order("created_at", { ascending: false });

    if (error) toast.error(error.message);
    setTeams((data as Team[]) ?? []);

    const leaderTeamIds = ((data as Team[]) ?? [])
      .filter((team) => team.leader_id === user.id)
      .map((team) => team.id);

    if (leaderTeamIds.length) {
      const requestResult = await supabase
        .from("join_requests")
        .select("*")
        .in("team_id", leaderTeamIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const requests = (requestResult.data as JoinRequest[]) ?? [];
      const requesterIds = [...new Set(requests.map((request) => request.user_id))];
      const profileResult = requesterIds.length
        ? await supabase.from("profiles").select("id, full_name, username, avatar_url, skills").in("id", requesterIds)
        : { data: [] };
      const profileMap = new Map(((profileResult.data as any[]) ?? []).map((profile) => [profile.id, profile]));
      const teamMap = new Map(((data as Team[]) ?? []).map((team) => [team.id, team]));

      setIncomingRequests(
        requests.map((request) => ({
          ...request,
          team: teamMap.get(request.team_id),
          profile: profileMap.get(request.user_id) ?? null,
        })),
      );
    } else {
      setIncomingRequests([]);
    }

    const outgoingResult = await supabase
      .from("join_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const outgoing = (outgoingResult.data as JoinRequest[]) ?? [];
    const outgoingTeamIds = [...new Set(outgoing.map((request) => request.team_id))];
    const outgoingTeamsResult = outgoingTeamIds.length
      ? await supabase.from("teams").select("*").in("id", outgoingTeamIds)
      : { data: [] };
    const outgoingTeamMap = new Map(((outgoingTeamsResult.data as Team[]) ?? []).map((team) => [team.id, team]));
    setOutgoingRequests(outgoing.map((request) => ({ ...request, team: outgoingTeamMap.get(request.team_id) })));
    setLoading(false);
  };

  useEffect(() => {
    loadTeams();
  }, [user?.id]);

  useEffect(() => {
    window.localStorage.setItem("syncup_team_draft", JSON.stringify({ form, skills, customSkill, open }));
  }, [customSkill, form, open, skills]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const toggleSkill = (skill: string) => setSkills((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]));
  const addCustomSkill = () => {
    const normalized = customSkill.trim();
    if (!normalized) return;
    if (!skills.some((skill) => skill.toLowerCase() === normalized.toLowerCase())) {
      setSkills((current) => [...current, normalized]);
    }
    setCustomSkill("");
  };

  const createTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const { data: team, error } = await supabase
        .from("teams")
        .insert({
          team_name: form.teamName,
          team_purpose: form.teamPurpose,
          target_name: form.targetName || null,
          target_url: form.targetUrl || null,
          project_title: form.projectTitle || null,
          description: form.description || null,
          max_members: Number(form.maxMembers) || 4,
          required_skills: skills,
          leader_id: user.id,
        } as never)
        .select("*")
        .single();

      if (error) throw error;

      const { error: memberError } = await supabase.from("team_members").insert({
        team_id: team.id,
        user_id: user.id,
        role: "leader",
      });
      if (memberError) throw memberError;

      await supabase.from("user_roles").upsert({ user_id: user.id, role: "team_leader" } as never);
      await (supabase as any).from("activity_history").insert({
        user_id: user.id,
        action: "team_created",
        details: `Created ${form.teamName}`,
        metadata: { team_id: team.id },
      });
      await notifyFollowers(
        user.id,
        "New team from someone you follow",
        `${form.teamName} was created. Check it out if you want to collaborate.`,
      );

      toast.success("Team created successfully.");
      setTeams((current) => [team as Team, ...current]);
      setOpen(false);
      setForm(defaultTeamForm);
      setSkills([]);
      setCustomSkill("");
      window.localStorage.removeItem("syncup_team_draft");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not create team.");
    } finally {
      setSaving(false);
    }
  };

  const decideRequest = async (request: JoinRequest, status: "accepted" | "rejected") => {
    if (!user) return;

    try {
      if (status === "accepted") {
        const { error: memberError } = await supabase.from("team_members").upsert({
          team_id: request.team_id,
          user_id: request.user_id,
          role: "member",
        } as never, { onConflict: "team_id,user_id" });
        if (memberError) throw memberError;
      }

      const { error } = await supabase
        .from("join_requests")
        .update({ status })
        .eq("id", request.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: request.user_id,
        title: status === "accepted" ? "Join request accepted" : "Join request rejected",
        message: `${request.team?.team_name ?? "A team"} ${status === "accepted" ? "accepted" : "rejected"} your request.`,
      });
      await (supabase as any).from("activity_history").insert({
        user_id: request.user_id,
        action: `join_request_${status}`,
        details: `${request.team?.team_name ?? "Team"} request ${status}`,
        metadata: { team_id: request.team_id, request_id: request.id },
      });

      setIncomingRequests((current) => current.filter((item) => item.id !== request.id));
      toast.success(status === "accepted" ? "Request accepted. Member added." : "Request rejected.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not update request.");
    }
  };

  const openMessageThread = async (request: JoinRequest) => {
    setMessageRequest(request);
    setThreadLoading(true);
    const { data, error } = await (supabase as any)
      .from("join_request_messages")
      .select("*")
      .eq("request_id", request.id)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setRequestMessages((data as RequestMessage[]) ?? []);
    setThreadLoading(false);
  };

  const sendThreadMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !messageRequest || !threadText.trim()) return;

    const text = threadText.trim();
    setThreadText("");
    const { data, error } = await (supabase as any)
      .from("join_request_messages")
      .insert({
        request_id: messageRequest.id,
        sender_id: user.id,
        message: text,
      })
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      setThreadText(text);
      return;
    }

    setRequestMessages((current) => [...current, data as RequestMessage]);
    const recipientId = messageRequest.user_id === user.id ? messageRequest.team?.leader_id : messageRequest.user_id;
    if (recipientId) {
      await supabase.from("notifications").insert({
        user_id: recipientId,
        title: "New request message",
        message: `${messageRequest.team?.team_name ?? "Team request"} has a new message.`,
      });
    }
  };

  return (
    <section className="space-y-6">
      <div className="glass-strong neon-border rounded-2xl p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">My Teams</h1>
            <p className="mt-2 text-white/55">Create teams, define required skills, and manage your workspace entry points.</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold shadow-[0_0_30px_rgba(99,102,241,0.35)] transition hover:shadow-[0_0_45px_rgba(99,102,241,0.6)]"
          >
            <Plus className="h-4 w-4" />
            Create team
          </button>
        </div>

        {loading ? (
          <div className="mt-8 grid place-items-center rounded-2xl bg-white/5 p-12">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
          </div>
        ) : teams.length ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => (
              <motion.article
                key={team.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500">
                    <Rocket className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs text-emerald-100">
                    {team.leader_id === user?.id ? "Leader" : "Member"}
                  </span>
                </div>
                <Link to="/teams/$id" params={{ id: team.id }} className="mt-4 block text-xl font-semibold hover:text-cyan-200">
                  {team.team_name}
                </Link>
                <p className="mt-1 text-sm text-cyan-100/80">{team.project_title || "Project title pending"}</p>
                <div className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/60">
                  <span className="text-cyan-200">{team.team_purpose || "Competition"}</span>
                  {team.target_name ? ` · ${team.target_name}` : ""}
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-white/55">{team.description || "No description added yet."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(team.required_skills ?? []).slice(0, 4).map((skill) => (
                    <span key={skill} className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/70">{skill}</span>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between text-sm text-white/50">
                  <span>{team.max_members ?? 4} max members</span>
                  <span>{new Date(team.created_at).toLocaleDateString()}</span>
                </div>
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-white/15 bg-white/5 p-12 text-center">
            <Users className="h-10 w-10 text-cyan-300" />
            <h2 className="mt-4 text-xl font-semibold">No active teams yet</h2>
            <p className="mt-2 max-w-md text-sm text-white/55">Create your first team and invite collaborators into a live workspace.</p>
            <Link to="/dashboard" className="mt-5 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/75 hover:bg-white/10">
              View recommendations
            </Link>
          </div>
        )}
      </div>

      <div className="glass-strong rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <MessageSquare className="h-5 w-5 text-cyan-300" />
              Incoming Join Requests
            </h2>
            <p className="mt-1 text-sm text-white/55">Requests sent to teams you lead appear here for approval.</p>
          </div>
          <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs text-cyan-100">{incomingRequests.length} pending</span>
        </div>

        {incomingRequests.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {incomingRequests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {request.profile?.avatar_url ? (
                      <img src={request.profile.avatar_url} alt="" className="h-11 w-11 rounded-xl object-cover" />
                    ) : (
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 font-bold">
                        {(request.profile?.full_name || request.profile?.username || "U").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <Link to="/profiles/$id" params={{ id: request.user_id }} className="rounded-xl p-1 transition hover:bg-white/5">
                      <h3 className="font-semibold">{request.profile?.full_name || request.profile?.username || "SyncUp user"}</h3>
                      <p className="text-sm text-cyan-100/70">wants to join {request.team?.team_name ?? "your team"}</p>
                    </Link>
                  </div>
                  <span className="rounded-full bg-yellow-300/15 px-3 py-1 text-xs text-yellow-100">Pending</span>
                </div>
                {request.message && (
                  <p className="mt-4 rounded-xl bg-black/20 p-3 text-sm text-white/70">{request.message}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(request.profile?.skills ?? []).slice(0, 5).map((skill) => (
                    <span key={skill} className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/70">{skill}</span>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => openMessageThread(request)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/15"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message
                  </button>
                  <button
                    onClick={() => decideRequest(request, "accepted")}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/20"
                  >
                    <Check className="h-4 w-4" />
                    Accept
                  </button>
                  <button
                    onClick={() => decideRequest(request, "rejected")}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-400/10 px-4 py-2.5 text-sm font-semibold text-red-100 hover:bg-red-400/15"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-white/55">
            No pending requests yet. When someone requests to join one of your teams, it will appear here.
          </div>
        )}
      </div>

      <div className="glass-strong rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              <Send className="h-5 w-5 text-cyan-300" />
              Your Sent Requests
            </h2>
            <p className="mt-1 text-sm text-white/55">Track requests you sent and continue messages with team leaders.</p>
          </div>
          <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs text-cyan-100">{outgoingRequests.length} total</span>
        </div>
        {outgoingRequests.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {outgoingRequests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link to="/teams/$id" params={{ id: request.team_id }} className="font-semibold hover:text-cyan-200">
                      {request.team?.team_name ?? "Team"}
                    </Link>
                    <p className="mt-1 text-sm text-white/50">{request.message || "No message added."}</p>
                  </div>
                  <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/70">{request.status}</span>
                </div>
                <button
                  onClick={() => openMessageThread(request)}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/15"
                >
                  <MessageSquare className="h-4 w-4" />
                  View / Reply
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-white/55">
            No sent requests yet. Use Discover to find teams and send one.
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <motion.form
            onSubmit={createTeam}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="neon-border glass-strong max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Create a team</h2>
                <p className="mt-1 text-sm text-white/55">Define your project, ideal collaborators, and team capacity.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Team name" value={form.teamName} onChange={(value) => update("teamName", value)} required />
              <Field label="Project title" value={form.projectTitle} onChange={(value) => update("projectTitle", value)} />
              <div>
                <label className="text-xs text-white/60">Team purpose</label>
                <select
                  value={form.teamPurpose}
                  onChange={(event) => update("teamPurpose", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
                >
                  {purposeOptions.map((purpose) => <option key={purpose}>{purpose}</option>)}
                </select>
              </div>
              <PurposeGuide purpose={form.teamPurpose} />
              <Field
                label={form.teamPurpose === "Competition" ? "Competition name" : form.teamPurpose === "Patent / IP Rights" ? "Patent / invention title" : "Target name"}
                value={form.targetName}
                onChange={(value) => update("targetName", value)}
                placeholder={form.teamPurpose === "Competition" ? "Smart India Hackathon" : "AI-based assistive device"}
              />
              <Field
                label="Reference URL"
                value={form.targetUrl}
                onChange={(value) => update("targetUrl", value)}
                placeholder="Competition link, patent brief, repo, or docs"
              />
              <Field label="Max members" type="number" value={form.maxMembers} onChange={(value) => update("maxMembers", value)} required />
              <div className="md:col-span-2">
                <label className="text-xs text-white/60">Required skills</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {skillOptions.map((skill) => {
                    const selected = skills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={`rounded-full border px-3 py-2 text-xs transition ${
                          selected ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={customSkill}
                    onChange={(event) => setCustomSkill(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomSkill();
                      }
                    }}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
                    placeholder="Add any new skill, tool, domain, or language"
                  />
                  <button
                    type="button"
                    onClick={addCustomSkill}
                    className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                  >
                    Add skill
                  </button>
                </div>
                {skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <button
                        type="button"
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className="rounded-full border border-cyan-300/40 bg-cyan-300/15 px-3 py-1.5 text-xs text-cyan-100"
                        title="Click to remove"
                      >
                        {skill} ×
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-white/60">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
                  placeholder="What are you building and who do you need?"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/75 hover:bg-white/10">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save team
              </button>
            </div>
          </motion.form>
        </div>
      )}

      {messageRequest && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="glass-strong neon-border flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Request messages</h2>
                <p className="mt-1 text-sm text-white/55">{messageRequest.team?.team_name ?? "Team request"}</p>
              </div>
              <button type="button" onClick={() => setMessageRequest(null)} className="rounded-xl p-2 text-white/60 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 min-h-64 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-black/20 p-4">
              {threadLoading ? (
                <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-300" /></div>
              ) : requestMessages.length ? requestMessages.map((item) => {
                const own = item.sender_id === user?.id;
                return (
                  <div key={item.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${own ? "bg-cyan-300/20 text-cyan-50" : "bg-white/8 text-white/75"}`}>
                      <p>{item.message}</p>
                      <p className="mt-1 text-[10px] text-white/35">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                );
              }) : (
                <p className="grid h-40 place-items-center text-center text-sm text-white/45">No messages yet. Start the conversation.</p>
              )}
            </div>

            <form onSubmit={sendThreadMessage} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={threadText}
                onChange={(event) => setThreadText(event.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
                placeholder="Write a message..."
              />
              <button className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold">
                <Send className="h-4 w-4" />
                Send
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </section>
  );
}

function PurposeGuide({ purpose }: { purpose: string }) {
  const isHackathon = purpose === "Competition";
  const isPatent = purpose === "Patent / IP Rights";
  const Icon = isPatent ? Lightbulb : isHackathon ? Trophy : Rocket;
  const title = isPatent ? "Patent/IP workspace" : isHackathon ? "Hackathon sprint setup" : "Project workspace";
  const copy = isPatent
    ? "Capture invention title, proof-of-concept goals, documentation needs, and research-heavy skills."
    : isHackathon
      ? "Prioritize deadline roles, pitch readiness, prototype speed, and event-specific requirements."
      : "Define the goal, collaborators, required skills, and the next build milestone.";

  return (
    <div className={`md:col-span-2 rounded-2xl border p-4 ${
      isPatent
        ? "border-amber-300/30 bg-amber-300/10"
        : isHackathon
          ? "border-cyan-300/30 bg-cyan-300/10"
          : "border-white/10 bg-white/5"
    }`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-white/60">{copy}</p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-white/60">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        min={type === "number" ? 2 : undefined}
        max={type === "number" ? 12 : undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
      />
    </div>
  );
}
