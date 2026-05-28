import { useEffect, useState } from "react";

/** Mouse-follow gradient + animated background mesh used across the page. */
export function CursorGlow() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
      style={{
        background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, rgba(99,102,241,0.12), transparent 60%)`,
      }}
    />
  );
}

export function FloatingParticles({ count = 30 }: { count?: number }) {
  const particles = Array.from({ length: count });
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((_, i) => {
        const size = Math.random() * 3 + 1;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const delay = Math.random() * 5;
        const duration = Math.random() * 6 + 6;
        return (
          <span
            key={i}
            className="absolute rounded-full bg-white/40"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              top: `${top}%`,
              animation: `float-slow ${duration}s ease-in-out ${delay}s infinite`,
              filter: "blur(0.4px)",
              boxShadow: "0 0 8px rgba(147,197,253,0.6)",
            }}
          />
        );
      })}
    </div>
  );
}

export function GradientBlobs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-blue-600/30 blur-[120px] animate-float-slow" />
      <div className="absolute top-40 right-0 h-[520px] w-[520px] rounded-full bg-purple-600/25 blur-[140px] animate-float-slow" style={{ animationDelay: "2s" }} />
      <div className="absolute bottom-0 left-1/3 h-[380px] w-[380px] rounded-full bg-cyan-500/20 blur-[120px] animate-float-slow" style={{ animationDelay: "4s" }} />
    </div>
  );
}
