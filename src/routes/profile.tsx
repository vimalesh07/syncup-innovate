import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Camera, Github, Globe, Linkedin, Loader2, Save, Send, ShieldCheck, Trophy, Users, X } from "lucide-react";
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
  const [form, setForm] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

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
    const { error } = await supabase.from("profiles").update({
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
    } as never).eq("id", user.id);
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
    toast.success("Profile updated.");
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

          <div className="mt-6 grid w-full grid-cols-3 gap-3">
            <Stat icon={ShieldCheck} label="Reliability" value={form.reliability_score ?? 100} />
            <Stat icon={Trophy} label="Wins" value={0} />
            <Stat icon={Users} label="Teams" value={0} />
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
        <button
          onClick={save}
          disabled={saving}
          className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save profile
        </button>
      </section>
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

function Stat({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <Icon className="mx-auto h-4 w-4 text-cyan-300" />
      <p className="mt-2 text-lg font-bold">{value}</p>
      <p className="text-[11px] text-white/45">{label}</p>
    </div>
  );
}
