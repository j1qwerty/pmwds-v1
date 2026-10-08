import type { OrganizationRecord } from "../../types";
import { Icon } from "../../components/ui/Icon";
import { EmptyState } from "../shared";

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
    <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-sm flex flex-col max-h-[calc(100vh-220px)] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Icon name="corporate_fare" size={15} className="text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Organizations</h3>
          <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {filtered.length}/{organizations.length}
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icon name="search" size={14} />
          </span>
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
          />
        </div>
      </div>

      {/* Organization List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {filtered.map((org) => {
              const isSelected = selectedOrgId === org.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => onSelect(org.id)}
                  className={`group relative text-left p-3 rounded-xl transition-all duration-200 border ${
                    isSelected
                      ? "bg-indigo-50/80 border-indigo-200 shadow-sm"
                      : "bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50/60"
                  }`}
                >
                  <div className="relative flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span
                        className={`font-semibold text-sm truncate block transition-colors duration-200 ${
                          isSelected ? "text-indigo-700" : "text-slate-700 group-hover:text-slate-900"
                        }`}
                      >
                        {org.name}
                      </span>
                      <span
                        className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                          isSelected
                            ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        <Icon name="layers" size={10} />
                        {org.departmentCount || 0} dept{(org.departmentCount || 0) !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div
                      className={`shrink-0 transition-all duration-300 ${
                        isSelected
                          ? "opacity-100 translate-x-0"
                          : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                      }`}
                    >
                      <Icon
                        name="chevron_right"
                        size={16}
                        className={isSelected ? "text-indigo-500" : "text-slate-400"}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="search_off"
            title="No organizations found"
            description="Try adjusting your search."
            compact
            accent="neutral"
          />
        )}
      </div>
    </div>
  );
}
