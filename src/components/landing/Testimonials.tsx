import { motion } from "framer-motion";
import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "I built my SIH-winning team in 2 days. The skill matching is shockingly accurate.",
    name: "Aditi Verma",
    role: "UI Designer · VIT",
    color: "from-pink-500 to-purple-500",
  },
  {
    quote: "Finally a place where ML engineers and designers actually find each other.",
    name: "Vikram Singh",
    role: "ML Engineer · IIIT Hyderabad",
    color: "from-cyan-400 to-blue-500",
  },
  {
    quote: "The reliability score changed how I think about teammates. No more ghosters.",
    name: "Sneha Patil",
    role: "Research Student · IIT Delhi",
    color: "from-emerald-400 to-cyan-500",
  },
  {
    quote: "We pitched, won, and incorporated — all through people we met on SyncUp.",
    name: "Arjun Kapoor",
    role: "Startup Founder · BITS Pilani",
    color: "from-amber-400 to-orange-500",
  },
];

export function Testimonials() {
  return (
    <section className="relative py-28 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-block px-3 py-1 rounded-full glass text-xs text-white/70 mb-4">Testimonials</div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Loved by <span className="text-gradient">innovators</span>
          </h2>
        </div>

        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6, rotate: -1 }}
              className="glass rounded-2xl p-6 hover:bg-white/[0.06] transition-all"
            >
              <Quote className="h-6 w-6 text-blue-400/60 mb-3" />
              <p className="text-sm text-white/80 leading-relaxed">"{t.quote}"</p>
              <div className="mt-5 flex items-center gap-3 pt-4 border-t border-white/5">
                <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-xs font-bold text-white`}>
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-white/55">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
