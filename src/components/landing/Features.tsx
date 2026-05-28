import { motion } from "framer-motion";
import { Brain, Trophy, User, MessageSquare, Shield, Sparkles } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Smart Team Matching",
    desc: "AI-powered teammate suggestions with skill compatibility scoring and team balance analysis.",
    bullets: ["AI teammate suggestions", "Skill compatibility", "Team balance score"],
    gradient: "from-blue-500 to-cyan-400",
  },
  {
    icon: Trophy,
    title: "Competition Discovery",
    desc: "Every hackathon, SIH, startup contest, symposium, and coding event — discoverable in one place.",
    bullets: ["Hackathons & SIH", "Startup contests", "Symposiums & coding"],
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: User,
    title: "Skill Profiles",
    desc: "Showcase your tech stack, portfolio, GitHub, and badges. Be discoverable by every team that needs you.",
    bullets: ["Tech stack tags", "GitHub integration", "Achievement badges"],
    gradient: "from-cyan-400 to-blue-500",
  },
  {
    icon: MessageSquare,
    title: "Real-Time Collaboration",
    desc: "Team chat, task boards, shared workspaces, and live progress tracking — built in.",
    bullets: ["Live team chat", "Task boards", "Shared workspace"],
    gradient: "from-emerald-400 to-cyan-500",
  },
  {
    icon: Shield,
    title: "Reliability Score",
    desc: "Trust signals built from team reviews, participation, and contribution analytics. No more ghosters.",
    bullets: ["Team reviews", "Participation score", "Contribution analytics"],
    gradient: "from-amber-400 to-orange-500",
  },
  {
    icon: Sparkles,
    title: "Innovation Community",
    desc: "Network, share ideas, find co-founders, and turn weekend projects into real startups.",
    bullets: ["Student networking", "Idea sharing", "Pitch collaborations"],
    gradient: "from-fuchsia-500 to-purple-500",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-28 overflow-hidden">
      <div className="absolute top-1/4 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[140px]" />
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-purple-600/20 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-block px-3 py-1 rounded-full glass text-xs text-white/70 mb-4">Platform Features</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Everything you need to <span className="text-gradient">build & ship</span>
          </h2>
          <p className="mt-4 text-white/60">
            From discovery to delivery — SyncUp is the operating system for student innovation.
          </p>
        </div>

        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative glass neon-border rounded-2xl p-6 overflow-hidden"
              >
                <div className={`absolute -top-20 -right-20 h-40 w-40 rounded-full bg-gradient-to-br ${f.gradient} opacity-20 blur-3xl group-hover:opacity-40 transition-opacity`} />
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{f.desc}</p>
                <ul className="mt-4 space-y-1.5">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-white/55">
                      <span className="h-1 w-1 rounded-full bg-gradient-to-r from-blue-400 to-purple-400" />
                      {b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
