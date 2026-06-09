import { motion } from "framer-motion";
import { MessageSquare, Search, ShieldCheck, Trophy } from "lucide-react";

const solutions = [
  {
    icon: Search,
    title: "Find teammates by skills",
    copy: "Move beyond scattered messages by searching for builders with the roles, tools, and interests your team needs.",
    color: "from-cyan-400 to-blue-500",
  },
  {
    icon: ShieldCheck,
    title: "Build trust before you invite",
    copy: "Use clear profiles, project history, portfolios, and role expectations to make better team decisions.",
    color: "from-emerald-400 to-cyan-500",
  },
  {
    icon: Trophy,
    title: "Prepare for competitions faster",
    copy: "Bring competition discovery, teammate search, and team requests into one focused workflow.",
    color: "from-amber-400 to-orange-500",
  },
  {
    icon: MessageSquare,
    title: "Keep requests in one place",
    copy: "Manage team requests, messages, and collaboration context without losing everything in separate chats.",
    color: "from-purple-500 to-pink-500",
  },
];

export function Testimonials() {
  return (
    <section className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-block px-3 py-1 rounded-full glass text-xs text-white/70 mb-4">Built to solve</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            What SyncUp is <span className="text-gradient">designed for</span>
          </h2>
          <p className="mt-4 text-white/60">
            Honest tools for student builders, without pretending early product signals are live platform data.
          </p>
        </div>

        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {solutions.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -6 }}
                className="glass rounded-2xl p-6 hover:bg-white/[0.06] transition-all"
              >
                <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm text-white/65 leading-relaxed">{item.copy}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
