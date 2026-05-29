import { createFileRoute, Link } from "@tanstack/react-router";
import { Github, Globe, Linkedin, MessageSquare, Send, ShieldCheck, Trophy, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PlatformShell } from "@/components/app/PlatformShell";
import { ProtectedPage } from "@/components/app/ProtectedPage";
import { supabase } from "@/integrations/supabase/client";
import { Profile, initials, profileCompletion } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

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
  const [stats, setStats] = useState({ teams: 0, requests: 0 });
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; sender_id: string; message: string; created_at: string }>>([]);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("id", id).maybeSingle().then(({ data }) => setProfile((data as Profile) ?? null));
    Promise.all([
      supabase.from("team_members").select("*", { count: "exact", head: true }).eq("user_id", id),
      supabase.from("join_requests").select("*", { count: "exact", head: true }).eq("user_id", id),
    ]).then(([teams, requests]) => setStats({ teams: teams.count ?? 0, requests: requests.count ?? 0 }));
  }, [id]);

  if (!profile) {
    return (
      <section className="glass-strong rounded-2xl p-10 text-center text-white/60">
        Profile not found.
      </section>
    );
  }

  const completion = profileCompletion(profile);

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

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat icon={ShieldCheck} label="Reliability" value={profile.reliability_score ?? 100} />
          <Stat icon={Users} label="Teams" value={stats.teams} />
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

function Stat({ icon: Icon, label, value, suffix = "" }: { icon: typeof ShieldCheck; label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <Icon className="mx-auto h-4 w-4 text-cyan-300" />
      <p className="mt-2 text-lg font-bold">{value}{suffix}</p>
      <p className="text-[11px] text-white/45">{label}</p>
    </div>
  );
}
