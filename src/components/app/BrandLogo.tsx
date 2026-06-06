import { useState } from "react";

type BrandLogoProps = {
  variant?: "light" | "dark";
  className?: string;
  showTagline?: boolean;
};

export function BrandLogo({ variant = "dark", className = "", showTagline = false }: BrandLogoProps) {
  const [markFailed, setMarkFailed] = useState(false);
  const [fullLogoFailed, setFullLogoFailed] = useState(false);
  const fallbackText = variant === "light" ? "text-white" : "text-slate-950 dark:text-white";
  const accentText = variant === "light" ? "text-cyan-200" : "text-cyan-700 dark:text-cyan-300";
  const fallbackMarkClass = variant === "light"
    ? "border-white/25 bg-white/10 text-white"
    : "border-slate-200 bg-slate-100 text-slate-950 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

  if (showTagline && !fullLogoFailed) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <img
          src="/logo-full.png"
          alt="SyncUp"
          className="h-24 w-auto max-w-[360px] object-contain sm:h-28 sm:max-w-[460px]"
          onError={() => setFullLogoFailed(true)}
        />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {!markFailed ? (
        <img
          src="/logo-mark.png"
          alt=""
          className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11"
          onError={() => setMarkFailed(true)}
        />
      ) : (
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-lg font-black shadow-sm sm:h-11 sm:w-11 ${fallbackMarkClass}`}>
          S
        </span>
      )}
      <span className={`text-xl font-black tracking-tight sm:text-2xl ${fallbackText}`}>
        Sync<span className={accentText}>Up</span>
      </span>
    </span>
  );
}
