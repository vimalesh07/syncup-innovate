import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type AvatarUser = {
  avatar_url?: string | null;
  profileImage?: string | null;
  avatarUrl?: string | null;
  photoURL?: string | null;
  image?: string | null;
  name?: string | null;
  fullName?: string | null;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
};

type SafeAvatarProps = {
  user?: AvatarUser | null;
  profile?: AvatarUser | null;
  src?: string | null;
  fallback?: string | null;
  fallbackIcon?: ReactNode;
  alt?: string;
  className?: string;
  imageClassName?: string;
  previewable?: boolean;
};

function getAvatarUrl(user?: AvatarUser | null, src?: string | null) {
  const value =
    src ||
    user?.profileImage ||
    user?.avatarUrl ||
    user?.photoURL ||
    user?.image ||
    user?.avatar_url ||
    "";

  const trimmed = `${value}`.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return "";
  if (trimmed.startsWith("file:") || trimmed.startsWith("\\\\")) return "";
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) return "";
  return trimmed;
}

function getInitial(user?: AvatarUser | null, fallback?: string | null) {
  const source =
    user?.name ||
    user?.fullName ||
    user?.full_name ||
    user?.username ||
    user?.email ||
    fallback ||
    "User";

  return source.trim().charAt(0).toUpperCase() || "U";
}

export function SafeAvatar({
  user,
  profile,
  src,
  fallback,
  fallbackIcon,
  alt,
  className,
  imageClassName,
  previewable = false,
}: SafeAvatarProps) {
  const avatarUser = user ?? profile ?? null;
  const avatarUrl = getAvatarUrl(avatarUser, src);
  const [imageError, setImageError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (!previewOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [previewOpen]);

  const shouldShowImage = Boolean(avatarUrl && !imageError);
  const label = alt || avatarUser?.name || avatarUser?.fullName || avatarUser?.full_name || avatarUser?.username || "User";
  const initial = getInitial(avatarUser, fallback);

  return (
    <>
      <span
        role={previewable ? "button" : undefined}
        tabIndex={previewable ? 0 : undefined}
        aria-label={previewable ? `Preview ${label} profile photo` : label}
        onClick={(event) => {
          if (!previewable) return;
          event.preventDefault();
          event.stopPropagation();
          setPreviewOpen(true);
        }}
        onKeyDown={(event) => {
          if (!previewable || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          event.stopPropagation();
          setPreviewOpen(true);
        }}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-sm font-semibold text-white ring-1 ring-white/10",
          previewable && "cursor-pointer transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-transparent",
          className,
        )}
      >
        {shouldShowImage ? (
          <img
            src={avatarUrl}
            alt={label}
            className={cn("h-full w-full object-cover", imageClassName)}
            onError={() => setImageError(true)}
          />
        ) : fallbackIcon ? (
          fallbackIcon
        ) : (
          <span>{initial}</span>
        )}
      </span>

      {previewOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${label} profile photo preview`}
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative flex w-full max-w-md flex-col items-center rounded-3xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl leading-none text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20 dark:hover:text-white"
              aria-label="Close profile photo preview"
            >
              ×
            </button>

            <div className="mt-5 grid aspect-square w-full max-w-[320px] place-items-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-7xl font-bold text-white shadow-xl ring-1 ring-slate-200 dark:ring-white/15">
              {shouldShowImage ? (
                <img src={avatarUrl} alt={label} className="h-full w-full object-cover" onError={() => setImageError(true)} />
              ) : fallbackIcon ? (
                <span className="text-5xl">{fallbackIcon}</span>
              ) : (
                <span>{initial}</span>
              )}
            </div>

            <p className="mt-5 max-w-full truncate text-base font-semibold">{label}</p>
          </div>
        </div>
      )}
    </>
  );
}
