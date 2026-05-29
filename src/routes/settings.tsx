import { createFileRoute } from "@tanstack/react-router";
import { Bell, Eye, Loader2, Mail, Save, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings | SyncUp" }] }),
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <ProtectedPage>
      <PlatformShell>
        <SettingsPage />
      </PlatformShell>
    </ProtectedPage>
  );
}

function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    email_notifications: true,
    team_invites: true,
    public_profile: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("profile_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: { data: typeof settings | null }) => {
        if (data) setSettings(data);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("profile_settings")
      .upsert({ user_id: user.id, ...settings, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Settings saved.");
  };

  return (
    <section className="mx-auto max-w-3xl glass-strong neon-border rounded-2xl p-6">
      <h1 className="text-3xl font-bold">Account settings</h1>
      <p className="mt-2 text-white/55">Control notifications, invites, and profile visibility.</p>
      <div className="mt-6 space-y-3">
        <Toggle icon={Mail} label="Email notifications" checked={settings.email_notifications} onChange={(value) => setSettings({ ...settings, email_notifications: value })} />
        <Toggle icon={Users} label="Team invite alerts" checked={settings.team_invites} onChange={(value) => setSettings({ ...settings, team_invites: value })} />
        <Toggle icon={Eye} label="Public profile" checked={settings.public_profile} onChange={(value) => setSettings({ ...settings, public_profile: value })} />
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-cyan-300" />
            <div>
              <p className="font-semibold">Session persistence</p>
              <p className="text-sm text-white/50">Supabase securely restores your JWT session between visits.</p>
            </div>
          </div>
        </div>
      </div>
      <button onClick={save} disabled={saving} className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-3 text-sm font-semibold">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save settings
      </button>
    </section>
  );
}

function Toggle({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: typeof Mail;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
      <span className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-cyan-300" />
        <span className="font-semibold">{label}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5" />
    </label>
  );
}
