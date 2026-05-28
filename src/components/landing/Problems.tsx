import { motion } from "framer-motion";
import { UserX, Clock, EyeOff, Search, ShieldOff, Palette } from "lucide-react";

const problems = [
  { icon: UserX, title: "Finding Reliable Teammates", desc: "Trust is hard. Random teammates ghost, miss deadlines, or lack the skills they claimed." },
  { icon: Clock, title: "Last-Minute Team Chaos", desc: "Days before submission, teams scramble. SyncUp pre-matches you with vetted innovators." },
  { icon: EyeOff, title: "Hidden Talent, Unnoticed", desc: "Brilliant designers, ML engineers, and researchers stay invisible to the people who need them." },
  { icon: Search, title: "Competitions Scattered", desc: "SIH, hackathons, symposiums, startup contests — all in different places, easy to miss." },
  { icon: ShieldOff, title: "No Trusted Collaboration", desc: "No shared workspace, no reliability score, no signal of who actually delivers." },
  { icon: Palette, title: "Non-Tech Contributors Ignored", desc: "Designers, writers, PMs, researchers — equally vital, equally overlooked. We fix that." },
];

export function Problems() {
  return (
    <section className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-purple-600/15 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-block px-3 py-1 rounded-full glass text-xs text-white/70 mb-4">The Problem</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Why Students <span className="text-gradient">Struggle</span> Today
          </h2>
          <p className="mt-4 text-white/60">
            The competition ecosystem is broken. Talented students lose opportunities because of friction nobody talks about.
          </p>
        </div>

        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {problems.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                whileHover={{ y: -6 }}
                className="group relative glass rounded-2xl p-6 hover:bg-white/[0.06] transition-all"
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: "radial-gradient(400px circle at var(--mx,50%) var(--my,50%), rgba(99,102,241,0.12), transparent 60%)" }}
                />
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center mb-5 group-hover:from-blue-500/50 group-hover:to-purple-500/50 transition-all">
                  <Icon className="h-5 w-5 text-blue-300" />
                </div>
                <h3 className="text-lg font-semibold text-white">{p.title}</h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{p.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
