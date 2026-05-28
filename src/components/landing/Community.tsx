import { motion } from "framer-motion";
import { Award, TrendingUp, Crown } from "lucide-react";

const innovators = [
  { name: "Ananya Sharma", role: "ML Engineer · IIT Bombay", score: 980, rank: 1, color: "from-amber-300 to-orange-500" },
  { name: "Rohan Mehta", role: "Full-stack Dev · BITS Pilani", score: 942, rank: 2, color: "from-slate-200 to-slate-400" },
  { name: "Priya Iyer", role: "UI/UX Designer · NID", score: 918, rank: 3, color: "from-amber-700 to-amber-900" },
  { name: "Karthik R.", role: "Founder · IIT Madras", score: 895, rank: 4, color: "from-blue-400 to-purple-500" },
];

const projects = [
  { title: "MediMatch AI", tag: "Healthcare · SIH Winner", color: "from-emerald-400 to-cyan-500" },
  { title: "EcoRoute", tag: "Sustainability · Top 10", color: "from-blue-500 to-cyan-400" },
  { title: "StudyBuddy GPT", tag: "EdTech · Launching", color: "from-purple-500 to-pink-500" },
];

export function Community() {
  return (
    <section id="community" className="relative py-28 overflow-hidden">
      <div className="absolute top-0 left-0 h-[400px] w-[400px] rounded-full bg-purple-600/15 blur-[140px]" />
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/15 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-block px-3 py-1 rounded-full glass text-xs text-white/70 mb-4">Community Showcase</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Meet the <span className="text-gradient">top innovators</span>
          </h2>
          <p className="mt-4 text-white/60">
            Real students. Real wins. Real momentum.
          </p>
        </div>

        <div className="mt-16 grid lg:grid-cols-3 gap-6">
          {/* Top Innovators */}
          <div className="lg:col-span-2 glass-strong rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Crown className="h-5 w-5 text-amber-400" />
              <h3 className="font-semibold text-white">Top Innovators This Week</h3>
            </div>
            <div className="space-y-3">
              {innovators.map((p, i) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition group"
                >
                  <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${p.color} flex items-center justify-center font-bold text-white shadow-lg`}>
                    {p.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{p.name}</div>
                    <div className="text-xs text-white/55">{p.role}</div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-amber-300">
                      <Award className="h-3 w-3" /> #{p.rank}
                    </div>
                    <div className="text-sm font-semibold text-white">{p.score}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Trending Projects */}
          <div className="glass-strong rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="h-5 w-5 text-cyan-300" />
              <h3 className="font-semibold text-white">Trending Projects</h3>
            </div>
            <div className="space-y-3">
              {projects.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative overflow-hidden rounded-xl p-4 bg-white/[0.03] hover:bg-white/[0.06] transition group cursor-pointer"
                >
                  <div className={`absolute -top-10 -right-10 h-24 w-24 rounded-full bg-gradient-to-br ${p.color} opacity-25 blur-2xl group-hover:opacity-50 transition`} />
                  <div className="relative">
                    <div className="text-sm font-semibold text-white">{p.title}</div>
                    <div className="text-xs text-white/55 mt-0.5">{p.tag}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
