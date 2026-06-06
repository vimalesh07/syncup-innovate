import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Copy, Edit3, Loader2, MailPlus, MessageSquare, MoreVertical, Pencil, Reply, Save, Send, Trash2, Users, X } from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { SafeAvatar } from "@/components/app/SafeAvatar";
import { supabase } from "@/integrations/supabase/client";
import { Profile } from "@/lib/auth";
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
  delivery_status?: "sending" | "failed";
  deleted_for?: string[] | null;
  deleted_for_everyone?: boolean | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  edited_at?: string | null;
  reply_to_id?: string | null;
  reactions?: Record<string, string[]> | null;
  profile?: Profile | null;
};

type TeamSharedPostMessage = {
  author: string;
  content: string;
};

const skillOptions = ["React", "AI/ML", "UI/UX", "Python", "Backend", "Research", "Pitching", "Product", "IoT"];
const purposeOptions = ["Competition", "Patent / IP Rights", "Startup", "Research Paper", "Open Source", "College Project", "Other"];
const teamReactions = ["👍", "❤️", "🔥", "😂", "😮"];

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
  const [teamMessageMenuPosition, setTeamMessageMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [replyToTeamMessage, setReplyToTeamMessage] = useState<TeamMessage | null>(null);
  const [editingTeamMessage, setEditingTeamMessage] = useState<TeamMessage | null>(null);
  const teamMessageScrollRef = useRef<HTMLDivElement | null>(null);
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
  const [pendingRequest, setPendingRequest] = useState<{ id: string; status: string } | null>(null);
  const [leavingTeam, setLeavingTeam] = useState(false);
  const isMember = members.some((member) => member.user_id === user?.id);
  const isLeader = team?.leader_id === user?.id;
  const hasRequest = Boolean(pendingRequest && (pendingRequest.status === "pending" || pendingRequest.status === "requested"));

  useEffect(() => {
    supabase.from("teams").select("*").eq("id", id).maybeSingle().then(({ data }) => setTeam((data as Team) ?? null));
    loadMembers();
    loadTeamMessages();
    if (user) {
      (supabase as any).from("saved_teams").select("id").eq("user_id", user.id).eq("team_id", id).maybeSingle().then(({ data }: { data: { id: string } | null }) => setSaved(Boolean(data)));
      // check if user has a pending join request
      (supabase as any).from("join_requests").select("id, status").eq("user_id", user.id).eq("team_id", id).maybeSingle().then(({ data }: { data: { id: string; status: string } | null }) => setPendingRequest(data));
    }
  }, [id, user?.id]);

  useEffect(() => {
    if (!user || (!isMember && !isLeader)) return;
    const channel = supabase
      .channel(`team-messages-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_messages", filter: `team_id=eq.${id}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldMessage = payload.old as TeamMessage;
          setTeamMessages((current) => current.filter((message) => message.id !== oldMessage.id));
          return;
        }
        const row = payload.new as TeamMessage;
        if (!row || (row.deleted_for ?? []).includes(user.id)) return;
        const profile = members.find((member) => member.user_id === row.sender_id)?.profile ?? null;
        setTeamMessages((current) => mergeTeamMessages(current, { ...row, profile }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user?.id, isMember, isLeader, members.length]);

  useEffect(() => {
    const element = teamMessageScrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [teamMessages.length]);

  useEffect(() => {
    if (!openMessageMenuId || typeof document === "undefined") return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".message-action-menu, .message-action-button")) return;
      setOpenMessageMenuId(null);
      setTeamMessageMenuPosition(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMessageMenuId(null);
        setTeamMessageMenuPosition(null);
      }
    };
    const closeOnViewportChange = () => {
      setOpenMessageMenuId(null);
      setTeamMessageMenuPosition(null);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [openMessageMenuId]);

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

    const rows = ((data as TeamMessage[]) ?? []).filter((row) => !(row.deleted_for ?? []).includes(user?.id ?? ""));
    const senderIds = [...new Set(rows.map((row) => row.sender_id))];
    const profileRows = senderIds.length ? await supabase.from("profiles").select("*").in("id", senderIds) : { data: [] };
    const profileMap = new Map(((profileRows.data as Profile[]) ?? []).map((profile) => [profile.id, profile]));
    setTeamMessages(rows.map((row) => ({ ...row, profile: profileMap.get(row.sender_id) ?? null })));
    setTeamMessagesLoading(false);
  };

  const requestJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !team) return;
    if (isLeader) {
      toast.error("You already lead this team.");
      setRequestOpen(false);
      return;
    }
    if (isMember) {
      toast.error("You are already a member of this team.");
      setRequestOpen(false);
      return;
    }
    if (hasRequest) {
      toast.error("You already have a pending request for this team.");
      setRequestOpen(false);
      return;
    }

    const { data, error } = await supabase.from("join_requests").insert({
      user_id: user.id,
      team_id: team.id,
      message: message.trim() || null,
      status: "pending",
    }).select("id, status").single();

    if (error) {
      toast.error(error.message.includes("duplicate") ? "You already requested to join this team." : error.message);
      return;
    }

    setPendingRequest(data as { id: string; status: string });
    await supabase.from("notifications").insert({
      user_id: team.leader_id,
      title: "New join request",
      message: `${user.email} requested to join ${team.team_name}`,
    });
    toast.success("Join request sent.");
    setRequestOpen(false);
    setMessage("");
  };

  const leaveTeam = async () => {
    if (!user || !team || isLeader) return;
    if (!window.confirm(`Leave ${team.team_name}?`)) return;

    setLeavingTeam(true);
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", team.id)
      .eq("user_id", user.id);
    setLeavingTeam(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setMembers((current) => current.filter((member) => member.user_id !== user.id));
    toast.success("Left team.");
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
    setOpenMessageMenuId(null);
    setTeamMessageMenuPosition(null);
    setTeamMessages((current) => current.filter((message) => message.id !== item.id));
    const { error } = await (supabase as any).from("team_messages").update({ deleted_for: deletedFor }).eq("id", item.id);
    if (error) {
      toast.error(error.message);
      await loadTeamMessages();
      return;
    }
    toast.success("Message deleted for you.");
  };

  const deleteTeamMessageForEveryone = async (item: TeamMessage) => {
    if (!user || item.sender_id !== user.id) return;
    const confirmed = window.confirm("Delete this message for everyone? Others will no longer be able to see it.");
    if (!confirmed) return;
    const deletedAt = new Date().toISOString();
    setOpenMessageMenuId(null);
    setTeamMessageMenuPosition(null);
    setTeamMessages((current) => current.map((message) => message.id === item.id ? { ...message, message: "", deleted_for_everyone: true, deleted_at: deletedAt, deleted_by: user.id } : message));
    const { error } = await (supabase as any)
      .from("team_messages")
      .update({ message: "", deleted_for_everyone: true, deleted_at: deletedAt, deleted_by: user.id })
      .eq("id", item.id)
      .eq("sender_id", user.id);
    if (error) {
      toast.error(error.message);
      await loadTeamMessages();
      return;
    }
    toast.success("Message deleted for everyone.");
  };

  const sendTeamMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !team || !teamMessageText.trim() || (!isMember && !isLeader)) return;

    const text = teamMessageText.trim();
    if (editingTeamMessage) {
      const { error } = await (supabase as any)
        .from("team_messages")
        .update({ message: text, edited_at: new Date().toISOString() })
        .eq("id", editingTeamMessage.id)
        .eq("sender_id", user.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      setTeamMessages((current) => current.map((message) => message.id === editingTeamMessage.id ? { ...message, message: text, edited_at: message.edited_at ?? new Date().toISOString() } : message));
      setEditingTeamMessage(null);
      setTeamMessageText("");
      return;
    }

    setTeamMessageText("");
    setSendingTeamMessage(true);
    const createdAt = new Date().toISOString();
    const tempMessage: TeamMessage = {
      id: `temp-${Date.now()}`,
      team_id: team.id,
      sender_id: user.id,
      message: text,
      created_at: createdAt,
      delivery_status: "sending",
      reply_to_id: replyToTeamMessage?.id.startsWith("temp-") ? null : replyToTeamMessage?.id ?? null,
      profile: members.find((member) => member.user_id === user.id)?.profile ?? null,
    };
    setTeamMessages((current) => mergeTeamMessages(current, tempMessage));
    const { data, error } = await (supabase as any)
      .from("team_messages")
      .insert({ team_id: team.id, sender_id: user.id, message: text, reply_to_id: tempMessage.reply_to_id })
      .select("*")
      .single();

    setSendingTeamMessage(false);
    if (error) {
      toast.error(error.message);
      setTeamMessages((current) => current.map((message) => message.id === tempMessage.id ? { ...message, delivery_status: "failed" } : message));
      return;
    }

    const newMessage = data as TeamMessage;
    const senderProfile = members.find((member) => member.user_id === user.id)?.profile ?? null;
    setTeamMessages((current) => mergeTeamMessages(current.filter((message) => message.id !== tempMessage.id), { ...newMessage, profile: senderProfile }));
    setReplyToTeamMessage(null);

    const recipients = members
      .map((member) => member.user_id)
      .filter((memberId) => memberId !== user.id);
    if (recipients.length) {
      await supabase.from("notifications").insert(
        recipients.map((recipientId) => ({
          user_id: recipientId,
          title: "New team message",
          message: `${senderProfile?.full_name || senderProfile?.username || user.email || "Someone"} sent a message in ${team.team_name}`,
          metadata: {
            type: "team_message",
            teamId: team.id,
            teamName: team.team_name,
            messageId: newMessage.id,
            senderId: user.id,
            senderName: senderProfile?.full_name || senderProfile?.username || user.email || "SyncUp user",
            messagePreview: text,
            targetPath: `/teams/${team.id}?tab=chat`,
          },
          target_path: `/teams/${team.id}?tab=chat`,
        })),
      );
    }
  };

  const closeTeamMessageMenu = () => {
    setOpenMessageMenuId(null);
    setTeamMessageMenuPosition(null);
  };

  const toggleTeamMessageMenu = (event: MouseEvent<HTMLButtonElement>, item: TeamMessage, own: boolean) => {
    if (openMessageMenuId === item.id) {
      closeTeamMessageMenu();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = own ? 220 : 148;
    const gutter = 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < menuHeight + gutter
      ? Math.max(gutter, rect.top - menuHeight - 8)
      : Math.min(window.innerHeight - menuHeight - gutter, rect.bottom + 8);
    const preferredLeft = own ? rect.right - menuWidth : rect.left;
    const left = Math.min(window.innerWidth - menuWidth - gutter, Math.max(gutter, preferredLeft));

    setTeamMessageMenuPosition({ top, left });
    setOpenMessageMenuId(item.id);
  };

  const copyTeamMessage = async (item: TeamMessage) => {
    await navigator.clipboard.writeText(item.message);
    closeTeamMessageMenu();
    toast.success("Message copied.");
  };

  const editTeamMessage = (item: TeamMessage) => {
    setEditingTeamMessage(item);
    setReplyToTeamMessage(null);
    setTeamMessageText(item.message);
    closeTeamMessageMenu();
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
            {!isLeader && isMember && (
              <button
                onClick={leaveTeam}
                disabled={leavingTeam}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-300/25 bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-100 hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {leavingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Leave team
              </button>
            )}
            {!isLeader && !isMember && (
              hasRequest ? (
                <button disabled className="flex items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-semibold text-amber-100">
                  Request pending
                </button>
              ) : (
                <button onClick={() => setRequestOpen(true)} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold">
                  <MailPlus className="h-4 w-4" />
                  Request to join
                </button>
              )
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
                    <SafeAvatar profile={member.profile} className="h-11 w-11" />
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

          <div ref={teamMessageScrollRef} className="mt-5 max-h-[440px] min-h-72 space-y-3 overflow-y-auto rounded-2xl bg-black/20 p-4">
            {teamMessagesLoading ? (
              <div className="grid h-48 place-items-center">
                <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
              </div>
            ) : teamMessages.length ? teamMessages.map((item) => {
              const own = item.sender_id === user?.id;
              const deleted = Boolean(item.deleted_for_everyone);
              const reply = item.reply_to_id ? teamMessages.find((message) => message.id === item.reply_to_id) : null;
              const sharedPost = parseTeamSharedPostMessage(item.message);
              return (
                <div key={item.id} className={`group flex gap-2 sm:gap-3 ${own ? "justify-end" : "justify-start"}`}>
                  {!own && (
                    <Link
                      to="/profiles/$id"
                      params={{ id: item.sender_id }}
                      className="mt-1 grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 text-xs font-bold ring-1 ring-white/10"
                      title="Open profile"
                    >
                      <SafeAvatar profile={item.profile} className="h-full w-full text-xs ring-0" />
                    </Link>
                  )}
                  <div className={`relative min-w-0 ${sharedPost ? "w-fit max-w-[85%] sm:max-w-[680px]" : "max-w-[85%] sm:max-w-[620px]"} ${own ? "ml-auto" : "mr-auto"}`}>
                    <div className={`relative rounded-2xl px-4 py-3 text-sm shadow-sm ${own ? "bg-cyan-300/20 text-cyan-50" : "bg-white/8 text-white/75"}`}>
                      {!deleted && (
                        <button
                          type="button"
                          onClick={(event) => toggleTeamMessageMenu(event, item, own)}
                          className="message-action-button absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-white/60 opacity-100 transition hover:bg-white/10 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                          title="Message actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      )}
                      {!own && <p className="mb-1 text-xs font-semibold text-cyan-100">{item.profile?.full_name || item.profile?.username || "Team member"}</p>}
                      {reply && !deleted && (
                        <div className="mb-2 rounded-lg border-l-2 border-cyan-300 bg-black/15 px-3 py-2 text-xs text-white/55">
                          Replying to: {reply.deleted_for_everyone ? "This message was deleted" : reply.message}
                        </div>
                      )}
                      {deleted ? (
                        <p className="italic text-white/45">This message was deleted</p>
                      ) : sharedPost ? (
                        <TeamSharedPostPreview sharedPost={sharedPost} />
                      ) : (
                        <p className="whitespace-pre-wrap break-words pr-7 [overflow-wrap:anywhere] sm:pr-0">{item.message}</p>
                      )}
                      <p className={`mt-2 text-[10px] text-white/35 ${own ? "text-right" : "text-left"}`}>
                        {item.delivery_status === "sending" ? "Sending..." : item.delivery_status === "failed" ? "Failed to send" : `${item.edited_at ? "edited · " : ""}${new Date(item.created_at).toLocaleString()}`}
                      </p>
                    </div>
                    {!deleted && openMessageMenuId === item.id && teamMessageMenuPosition && typeof document !== "undefined" && createPortal(
                      <div className="message-action-menu fixed z-[9999] w-52 rounded-xl border border-white/10 bg-[#0B0F19]/95 p-2 shadow-2xl backdrop-blur-xl" style={{ top: teamMessageMenuPosition.top, left: teamMessageMenuPosition.left }}>
                        <button onClick={() => { setReplyToTeamMessage(item); setEditingTeamMessage(null); closeTeamMessageMenu(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/75 hover:bg-white/10">
                          <Reply className="h-3.5 w-3.5" />
                          Reply
                        </button>
                        <button onClick={() => { copyTeamMessage(item); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/75 hover:bg-white/10">
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </button>
                        <button onClick={() => { deleteTeamMessageForMe(item); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/75 hover:bg-white/10">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete for me
                        </button>
                        {own && (
                          <>
                            <button onClick={() => { editTeamMessage(item); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/75 hover:bg-white/10">
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button onClick={() => { deleteTeamMessageForEveryone(item); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-200 hover:bg-red-500/10">
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete for everyone
                            </button>
                          </>
                        )}
                      </div>,
                      document.body,
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
            {(replyToTeamMessage || editingTeamMessage) && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65 sm:col-span-2 sm:w-full">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    {editingTeamMessage ? "Editing message" : "Replying to"}: {(editingTeamMessage ?? replyToTeamMessage)?.message || "This message was deleted"}
                  </span>
                  <button type="button" onClick={() => { setReplyToTeamMessage(null); setEditingTeamMessage(null); setTeamMessageText(""); }} className="rounded-lg p-1 text-white/50 hover:bg-white/10">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
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
              {editingTeamMessage ? "Save" : "Send"}
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

function mergeTeamMessages(messages: TeamMessage[], incoming: TeamMessage) {
  const next = messages
    .filter((message) => message.id !== incoming.id)
    .filter((message) => !isMatchingTeamTemp(message, incoming));
  return [...next, incoming].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
}

function isMatchingTeamTemp(temp: TeamMessage, incoming: TeamMessage) {
  if (!temp.id.startsWith("temp-") || incoming.id.startsWith("temp-")) return false;
  if (temp.sender_id !== incoming.sender_id || temp.team_id !== incoming.team_id || temp.message !== incoming.message) return false;
  return Math.abs(+new Date(temp.created_at) - +new Date(incoming.created_at)) < 30000;
}

function parseTeamSharedPostMessage(value?: string | null): TeamSharedPostMessage | null {
  if (!value) return null;
  const match = value.match(/^Shared a SyncUp post from ([^:\n]+):\s*\n+([\s\S]+)$/i);
  if (!match) return null;
  const author = match[1]?.trim();
  const content = match[2]?.trim();
  if (!author || !content) return null;
  return { author, content };
}

function TeamSharedPostPreview({ sharedPost }: { sharedPost: TeamSharedPostMessage }) {
  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan-100/70">Shared a SyncUp post</p>
        <p className="text-sm font-semibold text-white/85">from {sharedPost.author}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm leading-relaxed text-white/80 shadow-inner sm:p-4">
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{sharedPost.content}</p>
      </div>
    </div>
  );
}

function normalizeTeamReactions(value: TeamMessage["reactions"]) {
  if (!value || Array.isArray(value) || typeof value !== "object") return {} as Record<string, string[]>;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, users]) => Array.isArray(users))
      .map(([reaction, users]) => [reaction, [...new Set(users as string[])]])
      .filter(([, users]) => users.length),
  ) as Record<string, string[]>;
}

function toggleTeamUserReaction(current: Record<string, string[]>, userId: string, reaction: string) {
  const hadReaction = (current[reaction] ?? []).includes(userId);
  const next = Object.fromEntries(
    Object.entries(current)
      .map(([emoji, users]) => [emoji, users.filter((id) => id !== userId)])
      .filter(([, users]) => users.length),
  ) as Record<string, string[]>;

  if (!hadReaction) {
    next[reaction] = [...new Set([...(next[reaction] ?? []), userId])];
  }

  return next;
}
