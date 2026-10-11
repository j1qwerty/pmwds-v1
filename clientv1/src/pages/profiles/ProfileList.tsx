import type { User } from "../../types";
import { Avatar, EmptyState, GlassCard, HoverActions } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { roleDisplayNames } from "../../permissions";

interface ProfileListProps {
  users: User[];
  selectedUserId: string;
  onSelect: (user: User) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  /** Hide the inline search box (when search lives in the page FilterBar) */
  hideSearch?: boolean;
  /** Edit action (permission-gated by the page) */
  canEdit?: boolean;
  onEdit?: (user: User) => void;
}

export function ProfileList({
  users,
  selectedUserId,
  onSelect,
  searchTerm,
  onSearchChange,
  hideSearch = false,
  canEdit = false,
  onEdit,
}: ProfileListProps) {
  return (
    <GlassCard className="overflow-hidden">
      {/* Search */}
      {!hideSearch && (
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search profiles..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-9 pl-9 pr-9 rounded-lg border border-slate-200 text-xs outline-none bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* User List */}
      <div className={`divide-y divide-slate-100 overflow-y-auto ${hideSearch ? "max-h-[calc(100vh-20rem)]" : "max-h-[calc(100vh-16rem)]"}`}>
        {users.map((user, index) => {
          const isSelected = selectedUserId === user.id;
          const isActive = user.isActive !== false;
          const roleLabel = roleDisplayNames(user.roles).join(", ") || user.jobTitle;

          return (
            <div
              key={user.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(user)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(user);
                }
              }}
              className={`group text-left w-full px-4 py-3 cursor-pointer transition-all duration-200 flex items-center gap-3 card-stagger ${
                isSelected
                  ? "bg-indigo-50/80"
                  : "hover:bg-slate-50/70"
              }`}
              style={{ animationDelay: `${Math.min(index * 25, 250)}ms` }}
            >
              {/* Avatar */}
              <Avatar person={user} size="md" className="shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-red-500"}`}
                    title={isActive ? "Active" : "Inactive"}
                  />
                  <span className="font-semibold text-sm text-slate-800 truncate">
                    {user.fullName}
                  </span>
                  {user.isActive === false && (
                    <span className="text-[10px] text-slate-400 font-normal shrink-0">(Inactive)</span>
                  )}
                </div>
                {roleLabel && (
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                    {roleLabel}
                  </div>
                )}
                {user.email && (
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {user.email}
                  </div>
                )}
              </div>

              {/* Actions — view/edit revealed on hover (edit permission-gated) */}
              <HoverActions
                entity="users"
                className="shrink-0"
                onHover={[
                  { icon: "view", label: "View profile", onClick: () => onSelect(user) },
                  ...(canEdit && onEdit ? [{ icon: "edit", label: "Edit profile", onClick: () => onEdit(user) }] : []),
                ]}
              />

              <Icon
                name="chevron_right"
                size={18}
                className={`shrink-0 ${isSelected ? "text-indigo-500" : "text-slate-300"}`}
              />
            </div>
          );
        })}

        {users.length === 0 && (
          <EmptyState
            icon={searchTerm ? "search_off" : "person_off"}
            title={searchTerm ? "No profiles found" : "No people available"}
            description={searchTerm ? "Try adjusting your search." : "There are no people to display yet."}
            compact
            accent="neutral"
          />
        )}
      </div>
    </GlassCard>
  );
}
