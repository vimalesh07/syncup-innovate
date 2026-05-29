import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AlertTriangle, Camera, Github, Globe, Linkedin, Loader2, Save, ShieldCheck, Trash2, Trophy, UserCheck, UserPlus, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { supabase } from "@/integrations/supabase/client";
import { Profile, initials, profileCompletion } from "@/lib/auth";
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

type SocialListMode = "teams" | "followers" | "following";

function ProfileRoute() {
  return (
    <ProtectedPage>
      <PlatformShell>
        <ProfilePage />
      </PlatformShell>
    </ProtectedPage>
  );
}

function ProfilePage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<Profile>>({});
  const [socialStats, setSocialStats] = useState({ teams: 0, followers: 0, following: 0 });
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [followers, setFollowers] = useState<Profile[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<Profile[]>([]);
  const [listMode, setListMode] = useState<SocialListMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [formReady, setFormReady] = useState(false);

  const DRAFT_KEY = user ? `profile_draft_${user.id}` : "";

  useEffect(() => {
    if (!user || !profile || !DRAFT_KEY) return;

    const draft = localStorage.getItem(DRAFT_KEY);
    if (!draft) {
      setForm(profile);
      setFormReady(true);
      return;
    }

    try {
      const draftData = JSON.parse(draft) as Partial<Profile>;
      const draftProfile = { ...profile, ...draftData, id: user.id } as Profile;

      if (profileCompletion(draftProfile) > profileCompletion(profile)) {
        setForm(draftProfile);
      } else {
        localStorage.removeItem(DRAFT_KEY);
        setForm(profile);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      setForm(profile);
    }
    setFormReady(true);
  }, [profile, user?.id, DRAFT_KEY]);

  useEffect(() => {
    if (!user || !formReady || !DRAFT_KEY || form.id !== user.id) return;
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    }, 500);
    return () => clearTimeout(timer);
  }, [form, formReady, user?.id, DRAFT_KEY]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("team_members").select("team_id").eq("user_id", user.id),
      (supabase as any).from("user_follows").select("follower_id").eq("following_id", user.id),
      (supabase as any).from("user_follows").select("following_id").eq("follower_id", user.id),
    ]).then(async ([memberships, followerRows, followingRows]) => {
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
    });
  }, [user?.id]);

  const update = (key: keyof Profile, value: string | string[]) => setForm((current) => ({ ...current, [key]: value }));
  const skills = form.skills ?? [];
  const completion = profileCompletion(form as Profile);

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
    if (!user) return;
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
      return;
    }
    localStorage.removeItem(DRAFT_KEY);
    toast.success("Profile updated.");
    // notify auth hook to refresh profile across the app without a full reload
    window.dispatchEvent(new Event("profile_updated"));
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

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="glass-strong neon-border rounded-2xl p-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="" className="h-28 w-28 rounded-2xl object-cover ring-2 ring-cyan-300/40" />
            ) : (
              <div className="grid h-28 w-28 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 text-3xl font-bold">
                {initials(form as Profile, user?.email)}
              </div>
            )}
            <label className="absolute -bottom-2 -right-2 grid h-10 w-10 cursor-pointer place-items-center rounded-xl bg-cyan-300 text-[#0B0F19] shadow-lg">
              <Camera className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={(event) => event.target.files?.[0] && uploadAvatar(event.target.files[0])} />
            </label>
          </div>
          <h1 className="mt-5 text-2xl font-bold">{form.full_name || "Unnamed innovator"}</h1>
          <p className="text-sm text-cyan-200">@{form.username || "username"}</p>
          <p className="mt-3 text-sm text-white/55">{form.bio || "Add a bio to help teams understand your edge."}</p>

          <div className="mt-6 w-full rounded-2xl bg-white/5 p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Profile completion</span>
              <span className="text-cyan-200">{completion}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <motion.div animate={{ width: `${completion}%` }} className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-purple-400" />
            </div>
          </div>

          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <Stat icon={ShieldCheck} label="Reliability" value={form.reliability_score ?? 100} />
            <Stat icon={Trophy} label="Wins" value={0} />
            <Stat icon={Users} label="Teams" value={socialStats.teams} onClick={() => setListMode("teams")} />
            <Stat icon={UserPlus} label="Followers" value={socialStats.followers} onClick={() => setListMode("followers")} />
            <Stat icon={UserCheck} label="Following" value={socialStats.following} onClick={() => setListMode("following")} />
          </div>
        </div>
      </section>

      <section className="glass-strong rounded-2xl p-6">
        <h2 className="text-xl font-semibold">Edit profile</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Full name" value={form.full_name ?? ""} onChange={(value) => update("full_name", value)} />
          <Field label="Username" value={form.username ?? ""} onChange={(value) => update("username", value)} />
          <Field label="College" value={form.college ?? ""} onChange={(value) => update("college", value)} />
          <Field label="Role" value={form.role ?? ""} onChange={(value) => update("role", value)} />
          <Field label="GitHub" icon={Github} value={form.github_url ?? ""} onChange={(value) => update("github_url", value)} />
          <Field label="LinkedIn" icon={Linkedin} value={form.linkedin_url ?? ""} onChange={(value) => update("linkedin_url", value)} />
          <Field label="Portfolio" icon={Globe} value={form.portfolio_url ?? ""} onChange={(value) => update("portfolio_url", value)} />
          <div className="md:col-span-2">
            <label className="text-xs text-white/60">Bio</label>
            <textarea
              value={form.bio ?? ""}
              onChange={(event) => update("bio", event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-white/60">Skills</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {skillOptions.map((skill) => {
                const selected = skills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => update("skills", selected ? skills.filter((item) => item !== skill) : [...skills, skill])}
                    className={`rounded-full border px-3 py-2 text-xs transition ${
                      selected ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/60"
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save profile
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/15"
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </button>
        </div>
      </section>

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

function Field({
  label,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: typeof Github;
}) {
  return (
    <div>
      <label className="text-xs text-white/60">{label}</label>
      <div className="relative mt-1">
        {Icon && <Icon className="absolute left-3 top-3.5 h-4 w-4 text-white/35" />}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300 ${Icon ? "pl-10" : ""}`}
        />
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, onClick }: { icon: typeof ShieldCheck; label: string; value: number; onClick?: () => void }) {
  const className = `rounded-xl bg-white/5 p-3 text-center transition ${onClick ? "hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/40" : ""}`;
  const content = (
    <>
      <Icon className="mx-auto h-4 w-4 text-cyan-300" />
      <p className="mt-2 text-lg font-bold">{value}</p>
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
                to="/profiles/$id"
                params={{ id: person.id }}
                onClick={onClose}
                className="flex min-w-0 flex-1 items-center gap-3"
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
