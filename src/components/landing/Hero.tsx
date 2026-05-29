import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Compass, Users, Trophy, Rocket, GitBranch } from "lucide-react";
import { FloatingParticles, GradientBlobs } from "./Background";
import { AnimatedCounter } from "./AnimatedCounter";

const stats = [
  { value: 12000, suffix: "+", label: "Students" },
  { value: 3500, suffix: "+", label: "Teams Formed" },
  { value: 850, suffix: "+", label: "Competitions" },
  { value: 27000, suffix: "+", label: "Collaborations" },
];

const floatCards = [
  { icon: Users, title: "Smart Team Match", sub: "94% compatibility", top: "12%", left: "4%", delay: 0.2, color: "from-blue-500 to-cyan-400" },
  { icon: Trophy, title: "Smart India Hackathon", sub: "Deadline: 3 days", top: "20%", right: "4%", delay: 0.4, color: "from-purple-500 to-pink-400" },
  { icon: GitBranch, title: "AI Healthcare Project", sub: "5/6 members joined", bottom: "20%", left: "6%", delay: 0.6, color: "from-cyan-400 to-blue-500" },
  { icon: Rocket, title: "Launching Today", sub: "Pitch in 2h", bottom: "14%", right: "6%", delay: 0.8, color: "from-fuchsia-500 to-purple-500" },
];

export function Hero() {
  return (
    <section id="home" className="relative min-h-screen flex items-center pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 grid-bg" />
      <GradientBlobs />
      <FloatingParticles count={40} />

      {/* Floating UI Cards */}
      <div className="absolute inset-0 hidden lg:block pointer-events-none">
        {floatCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: c.delay, duration: 0.8, ease: "easeOut" }}
              style={{ top: c.top, left: c.left, right: c.right, bottom: c.bottom }}
              className="absolute"
            >
              <div className="glass-strong rounded-2xl p-4 w-64 animate-float-slow" style={{ animationDelay: `${c.delay}s` }}>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{c.title}</div>
                    <div className="text-xs text-white/60">{c.sub}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-ring" />
                  <span className="text-[11px] text-white/60">Live</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-white/80 mb-8"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          The collaboration platform for student innovators
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05]"
        >
          Build Your <span className="text-gradient">Dream Innovation</span>
          <br /> Team.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="mt-7 mx-auto max-w-2xl text-base sm:text-lg text-white/65 leading-relaxed"
        >
          SyncUp connects students, developers, designers, researchers, and innovators to form
          powerful competition teams and collaborate on groundbreaking ideas.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/dashboard"
            className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white font-medium shadow-[0_0_40px_-5px_rgba(99,102,241,0.6)] hover:shadow-[0_0_60px_-5px_rgba(99,102,241,0.9)] transition-all"
          >
            Find a Team
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#features"
            className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl glass-strong text-white font-medium hover:bg-white/10 transition-all"
          >
            <Compass className="h-4 w-4" />
            Explore Competitions
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-5">
              <div className="text-3xl sm:text-4xl font-bold text-gradient">
                <AnimatedCounter to={s.value} />{s.suffix}
              </div>
              <div className="mt-1 text-xs sm:text-sm text-white/60">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
