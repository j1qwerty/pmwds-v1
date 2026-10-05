import type { OrganizationRecord } from "../../types";
import { Icon } from "../../components/ui/Icon";

interface OrganizationListProps {
  organizations: OrganizationRecord[];
  selectedOrgId: string;
  onSelect: (id: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export function OrganizationList({ organizations, selectedOrgId, onSelect, searchTerm, onSearchChange }: OrganizationListProps) {
  const filtered = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl p-5 max-h-[calc(100vh-220px)] flex flex-col shadow-lg border border-blue-100">
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
          Organizations
        </h3>
      </div>

      {/* Search Bar */}
      <div className="mb-4 relative">
        <input
          type="text"
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-11 px-4 rounded-xl bg-blue-50/50 border border-blue-100 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
        {searchTerm && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="text-[10px] font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              {filtered.length}/{organizations.length}
            </span>
          </div>
        )}
      </div>

      {/* Organization List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
  {filtered.map((org) => {
    const isSelected = selectedOrgId === org.id;
    return (
      <button
        key={org.id}
        onClick={() => onSelect(org.id)}
        className={`
          group relative text-left p-4 rounded-xl cursor-pointer transition-all duration-200
          border
          ${
            isSelected
              ? "bg-blue-50/80 border-blue-700"
              : "bg-white border-slate-200 hover:border-blue-200 hover:shadow-md hover:shadow-blue-300"
          }
        `}
      >
        {/* Selected glow effect */}
        {isSelected && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-400/5 to-blue-500/5 ring-1 ring-blue-300/30 shadow-[0_0_15px_-3px_rgba(59,130,246,0.15)]" />
        )}
        
        <div className="relative flex items-center justify-between gap-4">
          {/* Organization Info */}
          <div className="min-w-0 flex-1">
            <span className={`
              font-medium text-sm truncate block transition-colors duration-200
              ${isSelected ? 'text-blue-700' : 'text-slate-700 group-hover:text-slate-900'}
            `}>
              {org.name}
            </span>
            <span className={`
              text-[10px] font-bold uppercase tracking-wider shrink-0 px-2 py-0.5 rounded-md border mt-1 inline-block
              ${isSelected 
                ? 'bg-blue-100 text-blue-600 border-blue-200' 
                : 'bg-slate-100 text-slate-500 border-slate-200'}
            `}>
              {org.departmentCount || 0} dept{(org.departmentCount || 0) !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Chevron indicator */}
          <div className={`
            shrink-0 transition-all duration-300
            ${isSelected ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}
          `}>
            <Icon name="chevron-right" size={16} className={isSelected ? 'text-blue-500' : 'text-slate-400'} />
          </div>
        </div>
      </button>
    );
  })}
  
  {filtered.length === 0 && (
    <div className="text-center py-16">
      <p className="text-sm font-medium text-slate-400">
        No organizations found
      </p>
      <p className="text-xs mt-1 text-slate-400">
        Try adjusting your search
      </p>
    </div>
  )}
</div>
    </div>
  );
}