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
}: SafeAvatarProps) {
  const avatarUser = user ?? profile ?? null;
  const avatarUrl = getAvatarUrl(avatarUser, src);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const shouldShowImage = Boolean(avatarUrl && !imageError);

  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-sm font-semibold text-white ring-1 ring-white/10",
        className,
      )}
    >
      {shouldShowImage ? (
        <img
          src={avatarUrl}
          alt={alt || avatarUser?.name || avatarUser?.fullName || avatarUser?.full_name || avatarUser?.username || "User"}
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setImageError(true)}
        />
      ) : fallbackIcon ? (
        fallbackIcon
      ) : (
        <span>{getInitial(avatarUser, fallback)}</span>
      )}
    </span>
  );
}
