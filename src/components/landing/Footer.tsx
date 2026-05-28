import { Sparkles, Twitter, Github, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative border-t border-white/5 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-400 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">Sync<span className="text-gradient">Up</span></span>
          </div>
          <p className="text-xs text-white/50">© 2026 SyncUp. Built for student innovators.</p>
          <div className="flex gap-3">
            {[Twitter, Github, Linkedin].map((Icon, i) => (
              <a key={i} href="#" className="h-9 w-9 rounded-lg glass flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition">
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
