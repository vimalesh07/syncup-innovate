import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Loader2, MailPlus, MessageSquare, MoreVertical, Pencil, Save, Send, Trash2, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { supabase } from "@/integrations/supabase/client";
import { Profile, initials } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/teams/$id")({
  head: () => ({ meta: [{ title: "Team | SyncUp" }] }),
  component: TeamDetailRoute,
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

type Member = {
  id: string;
  user_id: string;
  role: string | null;
  joined_at: string;
  profile?: Profile | null;
};

type TeamMessage = {
  id: string;
  team_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  deleted_for?: string[] | null;
  deleted_for_everyone?: boolean | null;
  profile?: Profile | null;
};

const skillOptions = ["React", "AI/ML", "UI/UX", "Python", "Backend", "Research", "Pitching", "Product", "IoT"];
const purposeOptions = ["Competition", "Patent / IP Rights", "Startup", "Research Paper", "Open Source", "College Project", "Other"];

function TeamDetailRoute() {
  return (
    <ProtectedPage>
      <PlatformShell>
        <TeamDetail />
      </PlatformShell>
    </ProtectedPage>
  );
}

function TeamDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const [teamMessageText, setTeamMessageText] = useState("");
  const [teamMessagesLoading, setTeamMessagesLoading] = useState(false);
  const [sendingTeamMessage, setSendingTeamMessage] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    teamName: "",
    teamPurpose: "Competition",
    targetName: "",
    targetUrl: "",
    projectTitle: "",
    description: "",
    maxMembers: "4",
  });
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [message, setMessage] = useState("");
  const isMember = members.some((member) => member.user_id === user?.id);
  const isLeader = team?.leader_id === user?.id;

  useEffect(() => {
    supabase.from("teams").select("*").eq("id", id).maybeSingle().then(({ data }) => setTeam((data as Team) ?? null));
    loadMembers();
    loadTeamMessages();
    if (user) {
      (supabase as any).from("saved_teams").select("id").eq("user_id", user.id).eq("team_id", id).maybeSingle().then(({ data }: { data: { id: string } | null }) => setSaved(Boolean(data)));
    }
  }, [id, user?.id]);

  const loadMembers = async () => {
    const memberRows = await supabase.from("team_members").select("*").eq("team_id", id).order("joined_at", { ascending: true });
    const rows = (memberRows.data as Member[]) ?? [];
    const ids = rows.map((row) => row.user_id);
    const profileRows = ids.length ? await supabase.from("profiles").select("*").in("id", ids) : { data: [] };
    const profileMap = new Map(((profileRows.data as Profile[]) ?? []).map((profile) => [profile.id, profile]));
    setMembers(rows.map((row) => ({ ...row, profile: profileMap.get(row.user_id) ?? null })));
  };

  const loadTeamMessages = async () => {
    setTeamMessagesLoading(true);
    const { data, error } = await (supabase as any)
      .from("team_messages")
      .select("*")
      .eq("team_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      setTeamMessages([]);
      setTeamMessagesLoading(false);
      return;
    }

    const rows = ((data as TeamMessage[]) ?? []).filter((row) => !row.deleted_for_everyone && !(row.deleted_for ?? []).includes(user?.id ?? ""));
    const senderIds = [...new Set(rows.map((row) => row.sender_id))];
    const profileRows = senderIds.length ? await supabase.from("profiles").select("*").in("id", senderIds) : { data: [] };
    const profileMap = new Map(((profileRows.data as Profile[]) ?? []).map((profile) => [profile.id, profile]));
    setTeamMessages(rows.map((row) => ({ ...row, profile: profileMap.get(row.sender_id) ?? null })));
    setTeamMessagesLoading(false);
  };

  const requestJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !team) return;

    const { error } = await supabase.from("join_requests").insert({
      user_id: user.id,
      team_id: team.id,
      message: message.trim() || null,
      status: "pending",
    });

    if (error) {
      toast.error(error.message.includes("duplicate") ? "You already requested to join this team." : error.message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: team.leader_id,
      title: "New join request",
      message: `${user.email} requested to join ${team.team_name}`,
    });
    toast.success("Join request sent.");
    setRequestOpen(false);
    setMessage("");
  };

  const openEdit = () => {
    if (!team || !isLeader) return;
    setEditForm({
      teamName: team.team_name,
      teamPurpose: team.team_purpose || "Competition",
      targetName: team.target_name || "",
      targetUrl: team.target_url || "",
      projectTitle: team.project_title || "",
      description: team.description || "",
      maxMembers: String(team.max_members ?? 4),
    });
    setEditSkills(team.required_skills ?? []);
    setCustomSkill("");
    setEditOpen(true);
  };

  const updateEdit = (key: keyof typeof editForm, value: string) => setEditForm((current) => ({ ...current, [key]: value }));
  const toggleEditSkill = (skill: string) => {
    setEditSkills((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]));
  };
  const addCustomSkill = () => {
    const normalized = customSkill.trim();
    if (!normalized) return;
    if (!editSkills.some((skill) => skill.toLowerCase() === normalized.toLowerCase())) {
      setEditSkills((current) => [...current, normalized]);
    }
    setCustomSkill("");
  };

  const saveTeamDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!team || !isLeader) return;

    setEditSaving(true);
    const updates = {
      team_name: editForm.teamName.trim(),
      team_purpose: editForm.teamPurpose || null,
      target_name: editForm.targetName.trim() || null,
      target_url: editForm.targetUrl.trim() || null,
      project_title: editForm.projectTitle.trim() || null,
      description: editForm.description.trim() || null,
      max_members: Number(editForm.maxMembers) || 4,
      required_skills: editSkills,
    };

    const { data, error } = await supabase
      .from("teams")
      .update(updates as never)
      .eq("id", team.id)
      .eq("leader_id", user?.id ?? "")
      .select("*")
      .single();

    setEditSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    setTeam(data as Team);
    setEditOpen(false);
    toast.success("Team details updated.");
  };

  const toggleSaved = async () => {
    if (!user || !team) return;
    if (saved) {
      await (supabase as any).from("saved_teams").delete().eq("user_id", user.id).eq("team_id", team.id);
      setSaved(false);
      toast.success("Team removed from saved.");
      return;
    }
    const { error } = await (supabase as any).from("saved_teams").insert({ user_id: user.id, team_id: team.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSaved(true);
    toast.success("Team saved.");
  };

  const removeMember = async (member: Member) => {
    if (!user || !team || !isLeader || member.user_id === team.leader_id) return;
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", team.id)
      .eq("user_id", member.user_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMembers((current) => current.filter((item) => item.user_id !== member.user_id));
    await supabase.from("notifications").insert({
      user_id: member.user_id,
      title: "Removed from team",
      message: `You were removed from ${team.team_name}.`,
    });
    toast.success("Member removed.");
  };

  const deleteTeamMessageForMe = async (item: TeamMessage) => {
    if (!user) return;
    const deletedFor = Array.from(new Set([...(item.deleted_for ?? []), user.id]));
    const { error } = await (supabase as any).from("team_messages").update({ deleted_for: deletedFor }).eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpenMessageMenuId(null);
    setTeamMessages((current) => current.filter((message) => message.id !== item.id));
  };

  const deleteTeamMessageForEveryone = async (item: TeamMessage) => {
    if (!user || item.sender_id !== user.id) return;
    const { error } = await (supabase as any).from("team_messages").update({ deleted_for_everyone: true }).eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpenMessageMenuId(null);
    setTeamMessages((current) => current.filter((message) => message.id !== item.id));
  };

  const sendTeamMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !team || !teamMessageText.trim() || (!isMember && !isLeader)) return;

    const text = teamMessageText.trim();
    setTeamMessageText("");
    setSendingTeamMessage(true);
    const { data, error } = await (supabase as any)
      .from("team_messages")
      .insert({ team_id: team.id, sender_id: user.id, message: text })
      .select("*")
      .single();

    setSendingTeamMessage(false);
    if (error) {
      toast.error(error.message);
      setTeamMessageText(text);
      return;
    }

    const newMessage = data as TeamMessage;
    const senderProfile = members.find((member) => member.user_id === user.id)?.profile ?? null;
    setTeamMessages((current) => [...current, { ...newMessage, profile: senderProfile }]);

    const recipients = members
      .map((member) => member.user_id)
      .filter((memberId) => memberId !== user.id);
    if (recipients.length) {
      await supabase.from("notifications").insert(
        recipients.map((recipientId) => ({
          user_id: recipientId,
          title: "New team message",
          message: `${team.team_name} has a new message.`,
        })),
      );
    }
  };

  if (!team) {
    return <section className="glass-strong rounded-2xl p-10 text-center text-white/60">Team not found.</section>;
  }

  return (
    <section className="space-y-6">
      <div className="glass-strong neon-border rounded-2xl p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm text-cyan-200">{team.team_purpose || "Team"}</p>
            <h1 className="mt-2 text-4xl font-bold">{team.team_name}</h1>
            <p className="mt-2 text-xl text-cyan-100/80">{team.project_title || "Project title pending"}</p>
            <p className="mt-4 max-w-3xl text-white/60">{team.description || "No description added yet."}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isLeader && (
              <button onClick={openEdit} className="flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/15">
                <Pencil className="h-4 w-4" />
                Edit team
              </button>
            )}
            <button onClick={toggleSaved} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/75 hover:bg-white/10">
              <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
              {saved ? "Saved" : "Save team"}
            </button>
            {!isLeader && !isMember && (
              <button onClick={() => setRequestOpen(true)} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold">
                <MailPlus className="h-4 w-4" />
                Request to join
              </button>
            )}
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Info label="Target" value={team.target_name || "Not specified"} />
          <Info label="Max members" value={`${team.max_members ?? 4}`} />
          <Info label="Created" value={new Date(team.created_at).toLocaleDateString()} />
        </div>
        {team.target_url && (
          <a href={team.target_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm text-cyan-300 hover:text-cyan-200">
            Open reference URL
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <section className="glass-strong rounded-2xl p-6">
          <h2 className="text-xl font-semibold">Required skills</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(team.required_skills ?? []).length ? (team.required_skills ?? []).map((skill) => (
              <span key={skill} className="rounded-full bg-cyan-300/15 px-3 py-1.5 text-xs text-cyan-100">{skill}</span>
            )) : <span className="text-sm text-white/45">No skills listed.</span>}
          </div>
        </section>

        <section className="glass-strong rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Users className="h-5 w-5 text-cyan-300" /> Members</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {members.map((member) => (
              <article key={member.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <Link to="/profiles/$id" params={{ id: member.user_id }} className="flex min-w-0 flex-1 items-center gap-3">
                    {member.profile?.avatar_url ? (
                      <img src={member.profile.avatar_url} alt="" className="h-11 w-11 rounded-xl object-cover" />
                    ) : (
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 font-bold">
                        {initials(member.profile ?? null)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{member.profile?.full_name || member.profile?.username || "SyncUp user"}</p>
                      <p className="text-sm text-white/50">{member.role || "member"}</p>
                    </div>
                  </Link>
                  {isLeader && member.user_id !== team.leader_id && (
                    <button onClick={() => removeMember(member)} className="rounded-xl p-2 text-red-200 hover:bg-red-500/10" title="Remove member">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {(isMember || isLeader) ? (
        <section className="glass-strong neon-border rounded-2xl p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <MessageSquare className="h-5 w-5 text-cyan-300" />
                Team Messages
              </h2>
              <p className="mt-1 text-sm text-white/55">A private room for accepted members of {team.team_name}.</p>
            </div>
            <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs text-cyan-100">{members.length} members</span>
          </div>

          <div className="mt-5 max-h-[440px] min-h-72 space-y-3 overflow-y-auto rounded-2xl bg-black/20 p-4">
            {teamMessagesLoading ? (
              <div className="grid h-48 place-items-center">
                <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
              </div>
            ) : teamMessages.length ? teamMessages.map((item) => {
              const own = item.sender_id === user?.id;
              return (
                <div key={item.id} className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}>
                  {!own && (
                    <Link
                      to="/profiles/$id"
                      params={{ id: item.sender_id }}
                      className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-xs font-bold ring-1 ring-white/10"
                      title="Open profile"
                    >
                      {item.profile?.avatar_url ? <img src={item.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(item.profile ?? null)}
                    </Link>
                  )}
                  <div className="relative">
                    <div className={`max-w-[82%] rounded-2xl px-4 py-3 pr-10 text-sm ${own ? "bg-cyan-300/20 text-cyan-50" : "bg-white/8 text-white/75"}`}>
                      {!own && <p className="mb-1 text-xs font-semibold text-cyan-100">{item.profile?.full_name || item.profile?.username || "Team member"}</p>}
                      <p className="whitespace-pre-wrap">{item.message}</p>
                      <p className="mt-1 text-[10px] text-white/35">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => setOpenMessageMenuId(openMessageMenuId === item.id ? null : item.id)} className="absolute right-2 top-2 rounded-lg p-1 text-white/50 hover:bg-white/10">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openMessageMenuId === item.id && (
                      <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-white/10 bg-[#101827] p-2 shadow-2xl">
                        <button onClick={() => deleteTeamMessageForMe(item)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-white/75 hover:bg-white/10">
                          Delete for me
                        </button>
                        {own && (
                          <button onClick={() => deleteTeamMessageForEveryone(item)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-red-200 hover:bg-red-500/10">
                            Delete for everyone
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <p className="grid h-48 place-items-center text-center text-sm text-white/45">
                No team messages yet. Start the workspace conversation.
              </p>
            )}
          </div>

          <form onSubmit={sendTeamMessage} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={teamMessageText}
              onChange={(event) => setTeamMessageText(event.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
              placeholder="Message all team members..."
            />
            <button
              disabled={sendingTeamMessage || !teamMessageText.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {sendingTeamMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </form>
        </section>
      ) : (
        <section className="glass-strong rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/55">
          Team messages unlock after you join this team.
        </section>
      )}

      {requestOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <motion.form initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} onSubmit={requestJoin} className="glass-strong neon-border w-full max-w-lg rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Request to join</h2>
                <p className="mt-1 text-sm text-white/55">{team.team_name}</p>
              </div>
              <button type="button" onClick={() => setRequestOpen(false)} className="rounded-xl p-2 text-white/60 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-cyan-300" placeholder="Tell the leader why you want to join." />
            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold">
              <Send className="h-4 w-4" />
              Send request
            </button>
          </motion.form>
        </div>
      )}

      {editOpen && team && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <motion.form
            onSubmit={saveTeamDetails}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="neon-border glass-strong max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Edit team details</h2>
                <p className="mt-1 text-sm text-white/55">{team.team_name}</p>
              </div>
              <button type="button" onClick={() => setEditOpen(false)} className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Team name" value={editForm.teamName} onChange={(value) => updateEdit("teamName", value)} required />
              <Field label="Project title" value={editForm.projectTitle} onChange={(value) => updateEdit("projectTitle", value)} />
              <div>
                <label className="text-xs text-white/60">Team purpose</label>
                <select
                  value={editForm.teamPurpose}
                  onChange={(event) => updateEdit("teamPurpose", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
                >
                  {purposeOptions.map((purpose) => <option key={purpose}>{purpose}</option>)}
                </select>
              </div>
              <Field label="Target name" value={editForm.targetName} onChange={(value) => updateEdit("targetName", value)} />
              <Field label="Reference URL" value={editForm.targetUrl} onChange={(value) => updateEdit("targetUrl", value)} />
              <Field label="Max members" type="number" value={editForm.maxMembers} onChange={(value) => updateEdit("maxMembers", value)} required />
              <div className="md:col-span-2">
                <label className="text-xs text-white/60">Required skills</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {skillOptions.map((skill) => {
                    const selected = editSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleEditSkill(skill)}
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
                    placeholder="Add a custom skill"
                  />
                  <button type="button" onClick={addCustomSkill} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15">
                    Add skill
                  </button>
                </div>
                {editSkills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {editSkills.map((skill) => (
                      <button
                        type="button"
                        key={skill}
                        onClick={() => toggleEditSkill(skill)}
                        className="rounded-full border border-cyan-300/40 bg-cyan-300/15 px-3 py-1.5 text-xs text-cyan-100"
                        title="Click to remove"
                      >
                        {skill} x
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-white/60">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(event) => updateEdit("description", event.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
                  placeholder="What are you building and who do you need?"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setEditOpen(false)} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/75 hover:bg-white/10">
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving || !editForm.teamName.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold disabled:opacity-60"
              >
                {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-4">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
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
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
      />
    </div>
  );
}
