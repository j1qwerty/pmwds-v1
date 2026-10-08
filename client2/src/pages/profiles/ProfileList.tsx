import type { User } from "../../types";
import { Avatar, EmptyState, SectionCard } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface ProfileListProps {
  users: User[];
  selectedUserId: string;
  onSelect: (user: User) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export function ProfileList({ users, selectedUserId, onSelect, searchTerm, onSearchChange }: ProfileListProps) {
  return (
    <SectionCard
      title={`Users (${users.length})`}
      icon="people"
      bodyClassName="p-4 flex flex-col max-h-[calc(100vh-7rem)]"
    >
      {/* Search */}
      <div className="mb-3 relative">
        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-9 pl-9 pr-9 rounded-lg border border-slate-200 text-xs outline-none bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400 transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1 -mr-2 pr-2">
        {users.map((user, index) => {
          const isSelected = selectedUserId === user.id;

          return (
            <button
              key={user.id}
              onClick={() => onSelect(user)}
              className={`text-left p-3 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-3 border card-stagger ${
                isSelected
                  ? "bg-indigo-50 border-indigo-200 shadow-sm"
                  : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"
              }`}
              style={{ animationDelay: `${Math.min(index * 25, 250)}ms` }}
            >
              {/* Avatar */}
              <Avatar person={user} size="md" className="shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-slate-800 truncate">
                  {user.fullName}
                  {user.isActive === false && (
                    <span className="ml-1.5 text-[10px] text-slate-400 font-normal">(Inactive)</span>
                  )}
                </div>
                {user.jobTitle && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400 truncate">
                      {user.jobTitle}
                    </span>
                  </div>
                )}
                {user.email && (
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {user.email}
                  </div>
                )}
              </div>

              {isSelected && (
                <Icon name="chevron_right" size={18} className="text-indigo-500 shrink-0" />
              )}
            </button>
          );
        })}

        {users.length === 0 && (
          <EmptyState
            icon={searchTerm ? "search_off" : "person_off"}
            title={searchTerm ? "No users found" : "No users available"}
            description={searchTerm ? "Try adjusting your search." : "There are no users to display yet."}
            compact
            accent="neutral"
          />
        )}
      </div>
    </SectionCard>
  );
}
