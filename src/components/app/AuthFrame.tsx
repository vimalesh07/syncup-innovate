import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { CursorGlow, FloatingParticles, GradientBlobs } from "@/components/landing/Background";

export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="syncup-app relative min-h-screen overflow-hidden px-4 py-10 text-white">
      <CursorGlow />
      <div className="absolute inset-0 grid-bg" />
      <GradientBlobs />
      <FloatingParticles count={32} />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-2xl"
        >
          <Link to="/" className="mb-8 flex items-center justify-center gap-2">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-400 glow-blue">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold">Sync<span className="text-gradient">Up</span></span>
          </Link>

          <section className="neon-border glass-strong rounded-2xl p-6 shadow-2xl sm:p-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm text-white/60">{subtitle}</p>
            </div>
            {children}
          </section>
        </motion.div>
      </div>
    </main>
  );
}
