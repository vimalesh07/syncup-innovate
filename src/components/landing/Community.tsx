import { motion } from "framer-motion";
import { Code2, Cpu, HeartPulse, Leaf, MessageSquarePlus, Palette, Search, UserRoundPlus, UsersRound } from "lucide-react";

const builderHelp = [
  { icon: UserRoundPlus, title: "Create your builder profile", copy: "Show your skills, role, portfolio links, and the kind of projects you want to join." },
  { icon: Search, title: "Find matching teammates", copy: "Discover students by domain, skills, interests, and collaboration intent." },
  { icon: MessageSquarePlus, title: "Send team requests", copy: "Invite builders with context so they know what you are building and why they fit." },
  { icon: UsersRound, title: "Collaborate inside teams", copy: "Keep team membership, requests, and messages connected to the project." },
];

const categories = [
  { icon: Cpu, title: "AI / ML", color: "from-cyan-400 to-blue-500" },
  { icon: HeartPulse, title: "Healthcare", color: "from-rose-400 to-pink-500" },
  { icon: Leaf, title: "Sustainability", color: "from-emerald-400 to-cyan-500" },
  { icon: Palette, title: "EdTech", color: "from-purple-500 to-pink-500" },
  { icon: Code2, title: "Web Apps", color: "from-blue-500 to-indigo-500" },
  { icon: Cpu, title: "Hardware + IoT", color: "from-amber-400 to-orange-500" },
];

export function Community() {
  return (
    <section id="community" className="relative py-28 overflow-hidden">
      <div className="absolute top-0 left-0 h-[400px] w-[400px] rounded-full bg-purple-600/15 blur-[140px]" />
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/15 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-block px-3 py-1 rounded-full glass text-xs text-white/70 mb-4">Builder workflow</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            How SyncUp helps <span className="text-gradient">builders</span>
          </h2>
          <p className="mt-4 text-white/60">
            Feature-focused previews of the collaboration flow. No fake rankings, no fake users, no inflated activity.
          </p>
        </div>

        <div className="mt-16 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-strong rounded-2xl p-6">
            <div className="grid sm:grid-cols-2 gap-4">
              {builderHelp.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-xl bg-white/[0.03] p-4 hover:bg-white/[0.06] transition"
                  >
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/70 to-purple-500/70 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-white/60">{item.copy}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="glass-strong rounded-2xl p-6">
            <div className="mb-5">
              <h3 className="font-semibold text-white">Project categories students can explore</h3>
              <p className="mt-1 text-xs text-white/55">Examples of domains, not live trending projects.</p>
            </div>
            <div className="space-y-3">
              {categories.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 }}
                    className="relative overflow-hidden rounded-xl p-4 bg-white/[0.03] hover:bg-white/[0.06] transition"
                  >
                    <div className={`absolute -top-10 -right-10 h-24 w-24 rounded-full bg-gradient-to-br ${item.color} opacity-25 blur-2xl`} />
                    <div className="relative flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
