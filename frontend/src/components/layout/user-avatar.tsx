type UserAvatarProps = {
  name: string;
  avatarUrl: string;
  className?: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserAvatar({ name, avatarUrl, className = "" }: UserAvatarProps) {
  const label = initialsFromName(name);
  const url = avatarUrl?.trim();

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`rounded-full object-cover ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white ${className}`}
    >
      {label}
    </div>
  );
}
