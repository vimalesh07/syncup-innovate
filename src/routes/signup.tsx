import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AuthFrame } from "@/components/app/AuthFrame";
import { SocialAuthButtons } from "@/components/app/SocialAuthButtons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create Account | SyncUp" }] }),
  component: SignupPage,
});

const skillsList = ["React", "AI/ML", "UI/UX", "Python", "Pitching", "Research", "Backend", "IoT"];
const roles = ["Developer", "Designer", "Researcher", "Presenter", "Team Leader", "Other"];

function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    college: "",
    role: "Developer",
    github: "",
    linkedin: "",
    portfolio: "",
  });
  const [skills, setSkills] = useState<string[]>([]);

  const strength = useMemo(() => {
    let score = 0;
    if (form.password.length >= 8) score += 25;
    if (/[A-Z]/.test(form.password)) score += 25;
    if (/[0-9]/.test(form.password)) score += 25;
    if (/[^A-Za-z0-9]/.test(form.password)) score += 25;
    return score;
  }, [form.password]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const toggleSkill = (skill: string) => {
    setSkills((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]));
  };

  const signup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (strength < 50) {
      toast.error("Use a stronger password before creating your account.");
      return;
    }

    setLoading(true);
    try {
      const username = form.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const metadata = {
        full_name: form.fullName.trim(),
        username,
        college: form.college.trim(),
        role: form.role,
        skills,
        github_url: form.github || null,
        linkedin_url: form.linkedin || null,
        portfolio_url: form.portfolio || null,
      };

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: metadata,
        },
      });
      if (error) throw error;

      let session = data.session;
      let user = data.user;

      if (!session) {
        const loginResult = await supabase.auth.signInWithPassword({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });

        if (loginResult.error) {
          throw new Error(
            loginResult.error.message.includes("Invalid login credentials")
              ? "Supabase accepted the signup request, but did not enable password login for this email. Delete duplicate users for this email in Supabase Auth, then create the account again."
              : loginResult.error.message,
          );
        }

        session = loginResult.data.session;
        user = loginResult.data.user;
      }

      if (session && user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          full_name: form.fullName.trim(),
          username,
          college: form.college.trim(),
          role: form.role,
          skills,
          github_url: form.github || null,
          linkedin_url: form.linkedin || null,
          portfolio_url: form.portfolio || null,
        } as never);
      }

      toast.success("Welcome to SyncUp.");
      navigate({ to: "/dashboard" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Signup failed.";
      toast.error(
        /rate limit/i.test(message)
          ? "Supabase is still sending signup emails and hit its email limit. Turn off Confirm email in Supabase Auth for direct signup/login."
          : message.includes("already registered")
          ? "This email already has an account. Please log in instead."
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="Create your innovation identity" subtitle="Build a trusted profile, discover teams, and start collaborating.">
      <div className="mt-6">
        <SocialAuthButtons mode="signup" />
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-white/40">
        <div className="h-px flex-1 bg-white/10" />or build your profile<div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={signup} className="grid gap-4 md:grid-cols-2">
        <Field label="Full Name" value={form.fullName} onChange={(value) => update("fullName", value)} required />
        <Field label="Username" value={form.username} onChange={(value) => update("username", value)} required />
        <Field label="Email" type="email" value={form.email} onChange={(value) => update("email", value)} required />
        <Field label="College / University" value={form.college} onChange={(value) => update("college", value)} required />

        <div>
          <label className="text-xs text-white/60">Password</label>
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm outline-none transition focus:border-cyan-300"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-white/50">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/10">
            <motion.div
              animate={{ width: `${strength}%` }}
              className="h-full rounded-full bg-gradient-to-r from-red-400 via-yellow-300 to-emerald-300"
            />
          </div>
        </div>
        <Field label="Confirm Password" type="password" value={form.confirmPassword} onChange={(value) => update("confirmPassword", value)} required />

        <div>
          <label className="text-xs text-white/60">Role</label>
          <select
            value={form.role}
            onChange={(event) => update("role", event.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
          >
            {roles.map((role) => <option key={role}>{role}</option>)}
          </select>
        </div>
        <Field label="GitHub URL" value={form.github} onChange={(value) => update("github", value)} />
        <Field label="LinkedIn URL" value={form.linkedin} onChange={(value) => update("linkedin", value)} />
        <Field label="Portfolio URL" value={form.portfolio} onChange={(value) => update("portfolio", value)} />

        <div className="md:col-span-2">
          <label className="text-xs text-white/60">Skills</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {skillsList.map((skill) => {
              const selected = skills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${
                    selected ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                  }`}
                >
                  {selected ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {skill}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="md:col-span-2 mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-5 py-3.5 font-semibold shadow-[0_0_40px_rgba(99,102,241,0.35)] transition hover:shadow-[0_0_60px_rgba(99,102,241,0.65)] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create Account <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/60">
        Already building here? <Link to="/login" className="font-semibold text-cyan-300">Log in</Link>
      </p>
    </AuthFrame>
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
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-cyan-300"
      />
    </div>
  );
}
