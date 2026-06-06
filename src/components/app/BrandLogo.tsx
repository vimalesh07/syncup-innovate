import { Sparkles } from "lucide-react";

type BrandLogoProps = {
  variant?: "light" | "dark";
  className?: string;
};

export function BrandLogo({ variant = "dark", className = "" }: BrandLogoProps) {
  const textClass = variant === "light" ? "text-white" : "text-slate-950 dark:text-white";
  const accentClass = variant === "light" ? "text-cyan-200" : "text-cyan-700 dark:text-cyan-300";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <img
          src="/logo.png"
          alt=""
          className="h-full w-full object-contain"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            event.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
        <Sparkles className="hidden h-5 w-5 text-slate-900" />
      </span>
      <span className={`text-xl font-bold tracking-tight ${textClass}`}>
        Sync<span className={accentClass}>Up</span>
      </span>
    </span>
  );
}
