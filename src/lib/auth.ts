import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  college: string | null;
  skills: string[] | null;
  role?: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url?: string | null;
  reliability_score: number;
  created_at?: string;
  updated_at?: string;
};

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
};

export async function getCurrentAuthState(): Promise<AuthState> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session?.user) {
    return { session: null, user: null, profile: null, loading: false };
  }

  const profile = await getOrCreateProfile(session.user);
  return { session, user: session.user, profile, loading: false };
}

export async function getOrCreateProfile(user: User): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (data) return data as Profile;

  const metadata = user.user_metadata ?? {};
  const generatedUsername =
    metadata.username || user.email?.split("@")[0] || `user_${user.id.slice(0, 6)}`;

  const profile = {
    id: user.id,
    full_name: metadata.full_name || metadata.name || null,
    username: `${generatedUsername}`.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    avatar_url: metadata.avatar_url || null,
    college: metadata.college || null,
    skills: Array.isArray(metadata.skills) ? metadata.skills : [],
    role: metadata.role || "Developer",
    github_url: metadata.github_url || null,
    linkedin_url: metadata.linkedin_url || null,
    portfolio_url: metadata.portfolio_url || null,
  };

  const { data: created } = await supabase
    .from("profiles")
    .upsert(profile as never, { onConflict: "id" })
    .select("*")
    .single();

  await (supabase as any).from("profile_settings").upsert({ user_id: user.id });
  await (supabase as any).from("activity_history").insert({
    user_id: user.id,
    action: "profile_created",
    details: "Profile initialized",
  });

  return (created as Profile) ?? null;
}

export function profileCompletion(profile: Profile | null) {
  if (!profile) return 0;
  const checks = [
    profile.avatar_url,
    profile.full_name,
    profile.username,
    profile.bio,
    profile.college,
    profile.role,
    profile.skills?.length,
    profile.github_url || profile.linkedin_url || profile.portfolio_url,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function initials(profile: Profile | null, email?: string | null) {
  const source = profile?.full_name || profile?.username || email || "SyncUp";
  return source
    .split(/[ _@.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
