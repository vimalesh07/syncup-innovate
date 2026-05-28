import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Menu, X } from "lucide-react";

const links = [
  { label: "Home", href: "#home" },
  { label: "Competitions", href: "#features" },
  { label: "Teams", href: "#demo" },
  { label: "Community", href: "#community" },
  { label: "About", href: "#how" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6`}>
        <div
          className={`flex items-center justify-between rounded-2xl px-4 sm:px-6 transition-all duration-300 ${
            scrolled ? "glass-strong py-2.5" : "py-3"
          }`}
        >
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-400 flex items-center justify-center glow-blue">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
            </div>
            <span className="text-xl font-bold tracking-tight">
              Sync<span className="text-gradient">Up</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm text-white/70 hover:text-white transition-colors relative group"
              >
                {l.label}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-gradient-to-r from-blue-400 to-purple-400 group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/auth"
              className="text-sm text-white/80 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition"
            >
              Login
            </Link>
            <Link
              to="/auth"
              className="relative text-sm font-medium px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all"
            >
              Get Started
            </Link>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 text-white"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden mt-2 glass-strong rounded-2xl p-4 flex flex-col gap-2"
          >
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm text-white/80 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/auth"
              className="text-center text-sm font-medium px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white mt-2"
            >
              Get Started
            </Link>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
}
