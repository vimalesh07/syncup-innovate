import { motion } from "framer-motion";
import { Heart, Sparkles, Users } from "lucide-react";

const recruits = [
  {
    title: "Looking for Frontend Developer",
    context: "Example hackathon team request",
    skills: ["React", "TypeScript", "Tailwind"],
    fit: "Frontend role fit",
    gradient: "from-blue-500 to-cyan-400",
  },
  {
    title: "Need UI/UX Designer",
    context: "Example product prototype request",
    skills: ["Figma", "Research", "Prototyping"],
    fit: "Design role fit",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    title: "Seeking ML Engineer",
    context: "Example AI project request",
    skills: ["PyTorch", "NLP", "MLOps"],
    fit: "ML role fit",
    gradient: "from-emerald-400 to-cyan-500",
  },
];

export function TeamMatchDemo() {
  return (
    <section id="demo" className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-block px-3 py-1 rounded-full glass text-xs text-white/70 mb-4">Demo Preview</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Find teams that <span className="text-gradient">match your skills</span>
          </h2>
          <p className="mt-4 text-white/60">
            Sample team request cards that show the kind of collaboration flow SyncUp is built for.
          </p>
        </div>

        <div className="mt-16 grid lg:grid-cols-3 gap-6">
          {recruits.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group glass-strong rounded-2xl p-6 hover:-translate-y-1 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${r.gradient} flex items-center justify-center`}>
                  <Users className="h-5 w-5 text-white" />
                </div>
                <button type="button" className="p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-pink-400 transition" aria-label="Save sample opportunity">
                  <Heart className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                Sample Opportunity
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{r.title}</h3>
              <div className="mt-1 text-xs text-white/60">{r.context}</div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {r.skills.map((s) => (
                  <span key={s} className="px-2.5 py-1 text-[11px] rounded-md bg-white/5 border border-white/10 text-white/70">
                    {s}
                  </span>
                ))}
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3 text-xs text-white/60 mb-1.5">
                  <span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-cyan-300" />Demo fit signal</span>
                  <span className="font-semibold text-white">{r.fit}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "72%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                    className={`h-full rounded-full bg-gradient-to-r ${r.gradient}`}
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Users className="h-3.5 w-3.5" /> Demo card
                </div>
                <button type="button" className="text-xs font-medium px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all">
                  Preview Request
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
