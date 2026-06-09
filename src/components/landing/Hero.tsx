import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Rocket } from "lucide-react";
import { FloatingParticles } from "./Background";

export function Hero() {
  return (
    <section id="home" className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-28 sm:px-6">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute left-1/2 top-1/2 h-[620px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-600/35 via-purple-600/35 to-cyan-500/25 blur-[160px]" />
      <FloatingParticles count={48} />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-white/80">
            <Rocket className="h-3 w-3 text-cyan-300" />
            Your launchpad is ready
          </div>

          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            Your Next Big <br />
            <span className="text-gradient">Innovation</span> Starts Here.
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
            Create your profile, discover builders, send team requests, and collaborate in one place.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              to="/signup"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-8 py-4 font-semibold text-white shadow-[0_0_60px_-10px_rgba(99,102,241,0.7)] transition-all hover:shadow-[0_0_80px_-10px_rgba(99,102,241,1)]"
            >
              Join SyncUp
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl glass-strong px-8 py-4 font-semibold text-white transition-all hover:bg-white/10"
            >
              Start Building
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
