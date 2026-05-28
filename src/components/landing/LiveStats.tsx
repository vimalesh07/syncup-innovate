import { motion } from "framer-motion";
import { AnimatedCounter } from "./AnimatedCounter";
import { Users, Trophy, Activity, GitBranch } from "lucide-react";

const stats = [
  { icon: Users, value: 142, label: "Teams created today", color: "from-blue-500 to-cyan-400" },
  { icon: Trophy, value: 64, label: "Active competitions", color: "from-purple-500 to-pink-500" },
  { icon: Activity, value: 8240, label: "Students online", color: "from-emerald-400 to-cyan-500" },
  { icon: GitBranch, value: 1320, label: "Projects in progress", color: "from-amber-400 to-orange-500" },
];

export function LiveStats() {
  return (
    <section className="relative py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="glass-strong rounded-3xl p-8 sm:p-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 text-xs text-emerald-300 mb-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-white">Platform activity right now</h3>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative p-5 rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden"
                >
                  <div className={`absolute -top-10 -right-10 h-24 w-24 rounded-full bg-gradient-to-br ${s.color} opacity-20 blur-2xl`} />
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-white">
                    <AnimatedCounter to={s.value} />
                  </div>
                  <div className="text-xs text-white/60 mt-1">{s.label}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
