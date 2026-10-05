type AvatarkPerson = {
  id?: string;
  userId?: string;
  name?: string | null;
  profilePictureUrl?: string | null;
  fullName?: string | null;
  email?: string | null;
  isActive?: boolean;
};

type AvatarkProps = {
  person?: AvatarkPerson | null;
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClass = {
  xs: "size-5 text-[9px]",
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
  xl: "size-20 text-xl",
};

const apiOrigin = (() => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  // Unset means local development against a separately hosted API.
  if (!configured) return "http://localhost:5179";
  // A relative base such as "/api/v1" means the API is served from this same origin; keep it empty
  // so composed paths stay root-relative instead of pointing at localhost.
  return configured.replace(/\/api\/v\d+\/?$/, "").replace(/\/$/, "");
})();

function toAvatarkPerson(person?: AvatarkPerson | null) {
  if (!person) return undefined;
  return {
    id: person.id,
    userId: person.userId,
    name: person.name ?? undefined,
    profilePictureUrl: person.profilePictureUrl,
    fullName: person.fullName ?? undefined,
    email: person.email ?? undefined,
    isActive: person.isActive,
  };
}

export function getAvatarUrl(person?: AvatarkPerson | null, nameOverride?: string | null, srcOverride?: string | null) {
  const source = srcOverride || person?.profilePictureUrl || "";
  if (source) {
    if (source.startsWith("/")) {
      return `${apiOrigin}${source}`;
    }
    if (source.startsWith("avatars/") || source.startsWith("documents/")) {
      return `${apiOrigin}/${source}`;
    }
    return source;
  }

  const label = nameOverride || person?.fullName || person?.name || person?.email || "User";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=e2e8f0&color=475569&size=128`;
}

export function Avatark({ person, name, src, size = "md", className = "" }: AvatarkProps) {
  const label = name || person?.fullName || person?.name || person?.email || "User";
  const inactive = person?.isActive === false;

  return (
    <img
      className={`${sizeClass[size]} rounded-full object-cover ring-2 ring-white shadow-sm bg-slate-100 ${inactive ? "opacity-60 ring-1 ring-red-300" : ""} ${className}`}
      src={getAvatarUrl(person, name, src)}
      alt={label}
      loading="lazy"
    />
  );
}

export function AvatarStackk({ users, limit = 4, size = "sm" }: { users: AvatarkPerson[]; limit?: number; size?: AvatarkProps["size"] }) {
  const visible = users.slice(0, limit);
  const extra = Math.max(users.length - visible.length, 0);

  return (
    <div className="flex items-center gap-1.5">
      {visible.map((person, index) => {
        const name = person.fullName || person.name || person.email || "User";
        return (
          <div
            key={person.id || person.userId || `${person.fullName || person.name || "user"}-${index}`}
            title={person.isActive === false ? `${name} (Inactive)` : name}
            className="relative group"
          >
            <Avatark person={toAvatarkPerson(person)} size={size} />
          </div>
        );
      })}
      {extra > 0 && (
        <span
          title={users.slice(limit).map(p => p.fullName || p.name || p.email || "User").join(", ")}
          className={`${sizeClass[size ?? "sm"]} grid place-items-center rounded-full bg-slate-100 font-semibold text-slate-500 cursor-default`}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
