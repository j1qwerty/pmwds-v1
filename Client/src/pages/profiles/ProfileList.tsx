import type { User } from "../../types";
import { Avatar, GlassCard } from "../shared";
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
    <GlassCard className="p-4 max-h-[calc(100vh-20px)] flex flex-col">
      <div className="mb-3 px-1">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Users ({users.length})
        </h3>
      </div>

      {/* Search */}
      <div className="mb-3 relative">
        <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {users.map((user, index) => {
          const isSelected = selectedUserId === user.id;
          
          return (
            <button
              key={user.id}
              onClick={() => onSelect(user)}
              className={`
                text-left p-3 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-3
                ${isSelected
                  ? "bg-indigo-50 border border-indigo-200 shadow-sm"
                  : "bg-white border border-transparent hover:bg-slate-50 hover:border-slate-200"
                }
              `}
              style={{ animation: `slideIn 0.3s ease ${index * 0.05}s both` }}
            >
              {/* Avatar */}
              <Avatar person={user} size="md" className="shrink-0" />
              
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-slate-800 truncate">
                  {user.fullName}
                  {user.isActive === false && <span className="ml-1.5 text-[10px] text-slate-400 font-normal">(Inactive)</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {user.jobTitle && (
                    <span className="text-[10px] text-slate-400 truncate">
                      {user.jobTitle}
                    </span>
                  )}
                </div>
                {user.email && (
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {user.email}
                  </div>
                )}
              </div>

              {isSelected && (
                <span className="material-symbols-outlined text-indigo-500 text-lg shrink-0">
                  chevron_right
                </span>
              )}
            </button>
          );
        })}

        {users.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Icon name={searchTerm ? "search_off" : "person_off"} size={28} className="mb-3 block" />
            <p className="text-sm font-medium">
              {searchTerm ? "No users found" : "No users available"}
            </p>
            <p className="text-xs mt-1">
              {searchTerm ? "Try adjusting your search" : ""}
            </p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
