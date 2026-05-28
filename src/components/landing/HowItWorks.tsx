import { motion } from "framer-motion";
import { UserPlus, Search, Handshake, Rocket } from "lucide-react";

const steps = [
  { icon: UserPlus, title: "Create Your Profile", desc: "Add your skills, portfolio, GitHub, and what you want to build." },
  { icon: Search, title: "Discover Competitions", desc: "Browse hackathons, SIH, startup contests, and symposiums in one feed." },
  { icon: Handshake, title: "Match With Teams", desc: "Use AI matching to find teammates whose skills complement yours." },
  { icon: Rocket, title: "Build & Innovate", desc: "Collaborate in real-time chat, task boards, and shared workspaces." },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative py-28 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[1000px] rounded-full bg-blue-600/10 blur-[160px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-block px-3 py-1 rounded-full glass text-xs text-white/70 mb-4">How It Works</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            From idea to <span className="text-gradient">innovation</span> in 4 steps
          </h2>
        </div>

        <div className="mt-20 relative">
          {/* Glowing connector line */}
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-blue-500/0 via-blue-500/60 to-purple-500/0" />

          <div className="grid lg:grid-cols-4 gap-8 lg:gap-4">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: i * 0.12 }}
                  className="relative text-center"
                >
                  <div className="relative mx-auto h-24 w-24 mb-6">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 blur-xl opacity-50" />
                    <div className="relative h-24 w-24 rounded-full glass-strong border border-white/15 flex items-center justify-center">
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm text-white/60 max-w-xs mx-auto">{s.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
