import { useState, useEffect, type FormEvent, useMemo, useCallback, useRef } from "react";
import type { PermissionRecord, RoleRecord } from "../../types";

interface RoleFormModalProps {
  initialData?: RoleRecord;
  permissions: PermissionRecord[];
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function RoleFormModal({ initialData, permissions, onSubmit, onCancel }: RoleFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const permissionsListRef = useRef<HTMLDivElement>(null);
  
  const [form, setForm] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    permissionLevel: initialData?.permissionLevel || 10,
  });
  
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(initialData?.permissions?.map(p => p.id) || [])
  );

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        description: initialData.description || "",
        permissionLevel: initialData.permissionLevel || 10,
      });
      setSelectedPermissions(new Set(initialData.permissions?.map(p => p.id) || []));
    }
  }, [initialData]);

  // Memoize grouped permissions to prevent recalculation on every render
  const groupedPermissions = useMemo(() => {
    const groups = permissions.reduce((acc, perm) => {
      const module = perm.module || "Other";
      if (!acc[module]) {
        acc[module] = {
          managePermission: null,
          regularPermissions: []
        };
      }
      
      if (perm.code?.endsWith('_manage') || perm.name?.toLowerCase().includes('manage all')) {
        acc[module].managePermission = perm;
      } else {
        acc[module].regularPermissions.push(perm);
      }
      
      return acc;
    }, {} as Record<string, { 
      managePermission: PermissionRecord | null, 
      regularPermissions: PermissionRecord[] 
    }>);
    
    return groups;
  }, [permissions]);

  // Filter modules based on search query
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return Object.entries(groupedPermissions);
    
    const query = searchQuery.toLowerCase();
    return Object.entries(groupedPermissions).filter(([moduleName, module]) => {
      // Check if module name matches
      if (moduleName.toLowerCase().includes(query)) return true;
      
      // Check if any permission matches
      return module.regularPermissions.some(
        p => p.name.toLowerCase().includes(query) || 
             p.code?.toLowerCase().includes(query)
      ) || (module.managePermission && (
        module.managePermission.name.toLowerCase().includes(query) ||
        module.managePermission.code?.toLowerCase().includes(query)
      ));
    });
  }, [groupedPermissions, searchQuery]);

  // Auto-expand filtered modules
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedModules(new Set(filteredModules.map(([name]) => name)));
    }
  }, [searchQuery, filteredModules]);

  const togglePermission = useCallback((permissionId: string) => {
    setSelectedPermissions(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(permissionId)) {
        newSelection.delete(permissionId);
      } else {
        newSelection.add(permissionId);
        
        // If selecting a manage permission, remove individual permissions from that module
        Object.values(groupedPermissions).forEach(module => {
          if (module.managePermission?.id === permissionId) {
            module.regularPermissions.forEach(p => newSelection.delete(p.id));
          }
        });
      }
      return newSelection;
    });
  }, [groupedPermissions]);

  const toggleManagePermission = useCallback((moduleName: string) => {
    const module = groupedPermissions[moduleName];
    if (!module?.managePermission) return;

    setSelectedPermissions(prev => {
      const newSelection = new Set(prev);
      
      if (newSelection.has(module.managePermission!.id)) {
        newSelection.delete(module.managePermission!.id);
      } else {
        newSelection.add(module.managePermission!.id);
        module.regularPermissions.forEach(p => newSelection.delete(p.id));
      }
      
      return newSelection;
    });
  }, [groupedPermissions]);

  const toggleModule = useCallback((moduleName: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleName)) {
        newSet.delete(moduleName);
      } else {
        newSet.add(moduleName);
      }
      return newSet;
    });
  }, []);

  const getModuleSelectionCount = useCallback((moduleName: string): number => {
    const module = groupedPermissions[moduleName];
    if (!module) return 0;
    
    if (module.managePermission && selectedPermissions.has(module.managePermission.id)) {
      return module.regularPermissions.length + 1;
    }
    
    return module.regularPermissions.filter(p => selectedPermissions.has(p.id)).length;
  }, [groupedPermissions, selectedPermissions]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    onSubmit({ ...form, permissionIds: Array.from(selectedPermissions) });
  };

  const totalSelected = selectedPermissions.size;

  // Virtual scrolling helper - only render visible items if needed
  const scrollToModule = (moduleName: string) => {
    setExpandedModules(prev => new Set([...prev, moduleName]));
    // Small delay to allow expansion before scrolling
    setTimeout(() => {
      const element = document.getElementById(`module-${moduleName}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
        : part
    );
  };

  return (
    <div className="bg-white rounded-2xl p-6 max-w-[100vw] shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-indigo-600 text-xl">
            {initialData ? "edit" : "shield"}
          </span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {initialData ? "Edit Role" : "Create Role"}
          </h2>
          <p className="text-xs text-slate-500">Configure role permissions</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 space-y-4">
        {/* Basic Info - Fixed */}
        <div className="flex-shrink-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                placeholder="e.g., Project Manager"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Level</label>
              <input
                type="number"
                value={form.permissionLevel}
                onChange={(e) => setForm({ ...form, permissionLevel: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                placeholder="10"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 resize-none"
              placeholder="Brief description of this role"
            />
          </div>
        </div>

        {/* Permissions Section - Scrollable */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">
                Permissions
              </label>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {totalSelected} selected
              </span>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-48">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search permissions..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Scrollable Permissions List - Optimized */}
          <div 
            ref={permissionsListRef}
            className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1"
            style={{ 
              willChange: 'transform',
              transform: 'translateZ(0)',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {filteredModules.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <span className="material-symbols-outlined text-3xl mb-2 block">search_off</span>
                <p className="text-sm">No permissions found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            )}
            
            {filteredModules.map(([moduleName, module]) => (
              <div 
                key={moduleName} 
                id={`module-${moduleName}`}
                className="border border-slate-200 rounded-lg bg-white"
              >
                {/* Module Header - Always visible */}
                <button
                  type="button"
                  onClick={() => toggleModule(moduleName)}
                  className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span 
                      className="material-symbols-outlined text-slate-400 text-lg flex-shrink-0 transition-transform duration-200"
                      style={{
                        transform: expandedModules.has(moduleName) ? 'rotate(90deg)' : 'rotate(0deg)'
                      }}
                    >
                      chevron_right
                    </span>
                    <div className="text-left min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">
                        {searchQuery ? highlightMatch(moduleName, searchQuery) : moduleName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {module.regularPermissions.length + (module.managePermission ? 1 : 0)} permissions
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {getModuleSelectionCount(moduleName) > 0 && (
                      <span className="text-[11px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                        {getModuleSelectionCount(moduleName)}
                      </span>
                    )}
                    
                    {module.managePermission && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleManagePermission(moduleName);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-green-50 cursor-pointer transition-colors"
                      >
                        <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          selectedPermissions.has(module.managePermission.id)
                            ? 'bg-green-500 border-green-500'
                            : 'border-slate-300'
                        }`}>
                          {selectedPermissions.has(module.managePermission.id) && (
                            <span className="material-symbols-outlined text-white text-[10px]">check</span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-green-700 whitespace-nowrap">Manage All</span>
                      </div>
                    )}
                  </div>
                </button>

                {/* Expanded Individual Permissions */}
                {expandedModules.has(moduleName) && (
                  <div className="border-t border-slate-100 p-2 space-y-1">
                    {module.managePermission && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-1.5">
                        <p className="text-[11px] text-amber-700 flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-amber-500 text-sm flex-shrink-0 mt-0.5">info</span>
                          <span>
                            <strong>"Manage All"</strong> includes all view, edit, and delete permissions in this module.
                          </span>
                        </p>
                      </div>
                    )}
                    
                    {/* Individual Permissions */}
                    <div className="space-y-0.5">
                      {module.regularPermissions.map((permission) => (
                        <label
                          key={permission.id}
                          className={`
                            flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-colors
                            ${selectedPermissions.has(permission.id)
                              ? "bg-indigo-50"
                              : "hover:bg-slate-50"
                            }
                            ${module.managePermission && selectedPermissions.has(module.managePermission.id)
                              ? "opacity-50 pointer-events-none"
                              : ""
                            }
                          `}
                        >
                          <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selectedPermissions.has(permission.id)
                              ? 'bg-indigo-500 border-indigo-500'
                              : 'border-slate-300'
                          }`}>
                            {selectedPermissions.has(permission.id) && (
                              <span className="material-symbols-outlined text-white text-[10px]">check</span>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedPermissions.has(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                            disabled={!!(module.managePermission && selectedPermissions.has(module.managePermission.id))}
                            className="hidden"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-700 truncate">
                              {searchQuery ? highlightMatch(permission.name, searchQuery) : permission.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              {searchQuery ? highlightMatch(permission.code || '', searchQuery) : permission.code}
                            </div>
                          </div>
                          {permission.isGlobal && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium flex-shrink-0">
                              Global
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                    
                    {/* Manage All in expanded view */}
                    {module.managePermission && (
                      <label
                        className={`
                          flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-colors mt-1
                          ${selectedPermissions.has(module.managePermission.id)
                            ? "bg-green-50 border border-green-200"
                            : "hover:bg-slate-50 border border-transparent"
                          }
                        `}
                      >
                        <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          selectedPermissions.has(module.managePermission.id)
                            ? 'bg-green-500 border-green-500'
                            : 'border-slate-300'
                        }`}>
                          {selectedPermissions.has(module.managePermission.id) && (
                            <span className="material-symbols-outlined text-white text-[10px]">check</span>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has(module.managePermission.id)}
                          onChange={() => toggleManagePermission(moduleName)}
                          className="hidden"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-green-700 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm flex-shrink-0">shield</span>
                            {searchQuery ? highlightMatch(module.managePermission.name, searchQuery) : module.managePermission.name}
                          </div>
                          <div className="text-[10px] text-green-600">
                            Includes all module permissions
                          </div>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium flex-shrink-0">
                          Manage All
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 flex-shrink-0">
          <button 
            type="button" 
            onClick={onCancel} 
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={submitting || !form.name} 
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : (initialData ? "Update Role" : "Create Role")}
          </button>
        </div>
      </form>
    </div>
  );
}