import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Rocket } from "lucide-react";
import { FloatingParticles } from "./Background";

export function FinalCTA() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[1000px] rounded-full bg-gradient-to-r from-blue-600/40 via-purple-600/40 to-cyan-500/30 blur-[160px]" />
      </div>
      <FloatingParticles count={50} />

      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-white/80 mb-8">
            <Rocket className="h-3 w-3 text-cyan-300" />
            Your launchpad is ready
          </div>

          <h2 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            Your Next Big <br />
            <span className="text-gradient">Innovation</span> Starts Here.
          </h2>

          <p className="mt-7 mx-auto max-w-xl text-white/65 text-base sm:text-lg">
            Join 12,000+ students already building the future. Your team is one click away.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white font-semibold shadow-[0_0_60px_-10px_rgba(99,102,241,0.7)] hover:shadow-[0_0_80px_-10px_rgba(99,102,241,1)] transition-all"
            >
              Join SyncUp
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl glass-strong text-white font-semibold hover:bg-white/10 transition-all"
            >
              Start Building
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
