import { useMemo, useState, useRef, useEffect } from "react";
import type { Department, Project, Task } from "../../../types";
import { getStatusColor, getPriorityColor } from "../colors";
import { Icon } from "../../../components/ui/Icon";

export type TaskPerformanceQuery = {
  page: number;
  pageSize: number;
  search?: string;
  projectId?: string;
  departmentId?: string;
  statuses?: string[];
  priorities?: string[];
  sortBy?: string;
  sortDirection?: "asc" | "desc";
};

type TaskPerformanceProps = {
  tasks?: Task[];
  projects?: Project[];
  departments?: Department[];
  totalCount?: number;
  totalPages?: number;
  page?: number;
  pageSize?: number;
  loading?: boolean;
  onQueryChange?: (query: TaskPerformanceQuery) => void;
  onViewTask?: (task: Task) => void | Promise<void>;
  onEditTask?: (task: Task) => void | Promise<void>;
  canEdit?: boolean;
};

// Progress bar color utility
const getProgressColor = (progress: number) => {
  if (progress >= 100) return "bg-red-500";
  if (progress >= 80) return "bg-cyan-500";
  if (progress >= 60) return "bg-blue-500";
  if (progress >= 40) return "bg-amber-500";
  if (progress >= 20) return "bg-emerald-500";
  return "bg-purple-500";
};

// Progress text color utility
const getProgressTextColor = (progress: number) => {
  if (progress >= 100) return "text-red-600";
  if (progress >= 80) return "text-cyan-600";
  if (progress >= 60) return "text-blue-600";
  if (progress >= 40) return "text-amber-600";
  if (progress >= 20) return "text-emerald-600";
  return "text-purple-600";
};

type SortDirection = "asc" | "desc";
type SortField = "title" | "progress" | "status" | "priority" | "dueDate" | null;

const statusOptions = ["NotStarted", "InProgress", "Completed", "Delayed", "OnHold", "Cancelled"];
const priorityOptions = ["Low", "Medium", "High", "Critical"];

export default function TaskPerformanceTable({
  tasks = [],
  projects = [],
  departments = [],
  totalCount,
  totalPages,
  page = 1,
  pageSize = 10,
  loading = false,
  onQueryChange,
  onViewTask,
  onEditTask,
  canEdit = false,
}: TaskPerformanceProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [canDelete, setCanDelete] = useState(false);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [statusMenuPos, setStatusMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [priorityMenuPos, setPriorityMenuPos] = useState<{ top: number; left: number } | null>(null);

  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  
  const itemsPerPage = pageSize;

  useEffect(() => {
    setCurrentPage(page);
  }, [page]);

  useEffect(() => {
    onQueryChange?.({
      page: currentPage,
      pageSize: itemsPerPage,
      search: searchTerm.trim() || undefined,
      projectId: projectFilter || undefined,
      departmentId: departmentFilter || undefined,
      statuses: statusFilter,
      priorities: priorityFilter,
      sortBy: sortField ?? undefined,
      sortDirection,
    });
  }, [
    currentPage,
    itemsPerPage,
    searchTerm,
    projectFilter,
    departmentFilter,
    statusFilter,
    priorityFilter,
    sortField,
    sortDirection,
    onQueryChange,
  ]);

  // Handle click outside and scroll for dropdowns
  useEffect(() => {
    const handleClose = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
        setStatusMenuPos(null);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target as Node)) {
        setShowPriorityDropdown(false);
        setPriorityMenuPos(null);
      }
    };

    const handleScroll = () => {
      setShowStatusDropdown(false);
      setShowPriorityDropdown(false);
      setStatusMenuPos(null);
      setPriorityMenuPos(null);
    };

    document.addEventListener("mousedown", handleClose);
    if (showStatusDropdown || showPriorityDropdown) {
      document.addEventListener("scroll", handleScroll, { capture: true });
    }

    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [showStatusDropdown, showPriorityDropdown]);

  const handleSort = (field: SortField, event?: React.MouseEvent<HTMLButtonElement>) => {
    if (field === "status" || field === "priority") {
      if (field === "status") {
        const opening = !showStatusDropdown;
        setShowStatusDropdown(opening);
        setShowPriorityDropdown(false);
        setPriorityMenuPos(null);
        if (opening) {
          const rect = event!.currentTarget.getBoundingClientRect();
          setStatusMenuPos({ top: rect.bottom + 4, left: rect.left });
        } else {
          setStatusMenuPos(null);
        }
      } else {
        const opening = !showPriorityDropdown;
        setShowPriorityDropdown(opening);
        setShowStatusDropdown(false);
        setStatusMenuPos(null);
        if (opening) {
          const rect = event!.currentTarget.getBoundingClientRect();
          setPriorityMenuPos({ top: rect.bottom + 4, left: rect.left });
        } else {
          setPriorityMenuPos(null);
        }
      }
      return;
    }

    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setShowStatusDropdown(false);
    setShowPriorityDropdown(false);
    setStatusMenuPos(null);
    setPriorityMenuPos(null);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
    setCurrentPage(1);
  };

  const handlePriorityFilter = (priority: string) => {
    setPriorityFilter(prev => 
      prev.includes(priority) 
        ? prev.filter(p => p !== priority)
        : [...prev, priority]
    );
    setCurrentPage(1);
  };

  const clearStatusFilter = () => {
    setStatusFilter([]);
    setCurrentPage(1);
  };

  const clearPriorityFilter = () => {
    setPriorityFilter([]);
    setCurrentPage(1);
  };

  const filteredAndSortedTasks = useMemo(() => {
    if (onQueryChange) return tasks;

    const query = searchTerm.toLowerCase();
    
    let result = tasks.filter(task => {
      if (task.parentTaskId) return false;
      
      // Search filter
      const matchesSearch = task.title.toLowerCase().includes(query) ||
        (task.projectName ?? "").toLowerCase().includes(query) ||
        (task.assignedToUserName ?? "").toLowerCase().includes(query);
      
      // Status filter
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(task.status);
      
      // Priority filter
      const matchesPriority = priorityFilter.length === 0 || priorityFilter.includes(task.priority);
      
      const matchesProject = !projectFilter || task.projectId === projectFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesProject;
    });

    // Sort
    if (sortField) {
      result.sort((a, b) => {
        let comparison = 0;
        
        switch (sortField) {
          case "title":
            comparison = a.title.localeCompare(b.title);
            break;
          case "progress":
            comparison = (a.progressPercentage || 0) - (b.progressPercentage || 0);
            break;
          case "dueDate":
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            comparison = dateA - dateB;
            break;
        }
        
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [tasks, searchTerm, sortField, sortDirection, statusFilter, priorityFilter, projectFilter, onQueryChange]);

  const effectiveTotalCount = totalCount ?? filteredAndSortedTasks.length;
  const effectiveTotalPages = totalPages ?? Math.max(1, Math.ceil(filteredAndSortedTasks.length / itemsPerPage));
  const paginatedTasks = onQueryChange
    ? tasks
    : filteredAndSortedTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleDeleteTask = (id: string) => {
    console.log("Delete task:", id);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <Icon name="hi-selector" size={12} className="text-slate-300 group-hover:text-slate-400" />;
    }
    return sortDirection === "asc" ? (
      <Icon name="chevron-up" size={12} className="text-slate-600" />
    ) : (
      <Icon name="chevron-down" size={12} className="text-slate-600" />
    );
  };

  const hasActiveFilters = statusFilter.length > 0 || priorityFilter.length > 0 || Boolean(projectFilter) || Boolean(departmentFilter) || Boolean(searchTerm);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
      <div className="flex flex-col gap-3 lg:flex-row lg:justify-between lg:items-center mb-6 pb-2 border-b border-b-slate-200">
        <h3 className="text-md font-bold text-slate-700">Task Performance</h3>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchTerm("");
                setProjectFilter("");
                setDepartmentFilter("");
                clearStatusFilter();
                clearPriorityFilter();
              }}
              className="text-xs text-rose-500 hover:text-rose-700 font-medium flex items-center gap-1"
            >
              <Icon name="close" size={12} />
              Clear filters
            </button>
          )}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
            <input
              type="text"
              placeholder="Search tasks"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl w-full lg:w-72 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <select
            value={projectFilter}
            onChange={(event) => {
              setProjectFilter(event.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl w-full lg:w-56 bg-white focus:outline-none focus:border-cyan-400"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <select
            value={departmentFilter}
            onChange={(event) => {
              setDepartmentFilter(event.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl w-full lg:w-56 bg-white focus:outline-none focus:border-cyan-400"
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-white/70 text-sm text-slate-500">
            Loading tasks...
          </div>
        )}
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-xs font-medium text-slate-500 py-3 px-2">
                <button 
                  onClick={() => handleSort("title")}
                  className="flex items-center gap-1 group hover:text-slate-700 transition-colors"
                >
                  Task
                  {getSortIcon("title")}
                </button>
              </th>
              <th className="text-left text-xs font-medium text-slate-500 py-3 px-2">
                <button 
                  onClick={() => handleSort("progress")}
                  className="flex items-center gap-1 group hover:text-slate-700 transition-colors"
                >
                  Progress
                  {getSortIcon("progress")}
                </button>
              </th>
              <th className="text-left text-xs font-medium text-slate-500 py-3 px-2">
                <div ref={statusDropdownRef}>
                  <button 
                    onClick={(e) => handleSort("status", e)}
                    className="flex items-center gap-1 group hover:text-slate-700 transition-colors"
                  >
                    Status
                    <Icon name="chevron-down" size={12} className={`transition-transform ${showStatusDropdown ? 'rotate-180 text-slate-600' : 'text-slate-300 group-hover:text-slate-400'}`} />
                    {statusFilter.length > 0 && (
                      <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                    )}
                  </button>
                  {showStatusDropdown && statusMenuPos && (
                    <div 
                      className="fixed bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-2 min-w-[160px]"
                      style={{
                        top: statusMenuPos.top,
                        left: statusMenuPos.left,
                      }}
                    >
                      <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                        <span className="text-xs font-medium text-slate-500">Filter by Status</span>
                        <button onClick={clearStatusFilter} className="text-xs text-rose-400 hover:text-rose-600">Clear</button>
                      </div>
                      {statusOptions.map(status => {
                        const statusColor = getStatusColor(status);
                        return (
                          <label key={status} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={statusFilter.includes(status)}
                              onChange={() => handleStatusFilter(status)}
                              className="rounded border-slate-300 text-cyan-500 focus:ring-cyan-400"
                            />
                            <span className={`text-xs font-medium ${statusColor.text}`}>{status}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </th>
              <th className="text-left text-xs font-medium text-slate-500 py-3 px-2">
                <div ref={priorityDropdownRef}>
                  <button 
                    onClick={(e) => handleSort("priority", e)}
                    className="flex items-center gap-1 group hover:text-slate-700 transition-colors"
                  >
                    Priority
                    <Icon name="chevron-down" size={12} className={`transition-transform ${showPriorityDropdown ? 'rotate-180 text-slate-600' : 'text-slate-300 group-hover:text-slate-400'}`} />
                    {priorityFilter.length > 0 && (
                      <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                    )}
                  </button>
                  {showPriorityDropdown && priorityMenuPos && (
                    <div 
                      className="fixed bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-2 min-w-[160px]"
                      style={{
                        top: priorityMenuPos.top,
                        left: priorityMenuPos.left,
                      }}
                    >
                      <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                        <span className="text-xs font-medium text-slate-500">Filter by Priority</span>
                        <button onClick={clearPriorityFilter} className="text-xs text-rose-400 hover:text-rose-600">Clear</button>
                      </div>
                      {priorityOptions.map(priority => {
                        const priorityColor = getPriorityColor(priority);
                        return (
                          <label key={priority} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={priorityFilter.includes(priority)}
                              onChange={() => handlePriorityFilter(priority)}
                              className="rounded border-slate-300 text-cyan-500 focus:ring-cyan-400"
                            />
                            <span className={`text-xs font-medium ${priorityColor.text}`}>{priority}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </th>
              <th className="text-left text-xs font-medium text-slate-500 py-3 px-2">
                <button 
                  onClick={() => handleSort("dueDate")}
                  className="flex items-center gap-1 group hover:text-slate-700 transition-colors"
                >
                  Due Date
                  {getSortIcon("dueDate")}
                </button>
              </th>
              <th className="text-left text-xs font-medium text-slate-500 py-3 px-2">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {paginatedTasks.map(task => {
              const statusColor = getStatusColor(task.status);
              const priorityColor = getPriorityColor(task.priority);
              const progress = task.progressPercentage || 0;
              const progressBarColor = getProgressColor(progress);
              const progressTextColor = getProgressTextColor(progress);

              return (
                <tr key={task.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="py-4 px-2">
                    <button className="text-left" onClick={() => onViewTask?.(task)}>
                      <div className="font-medium text-slate-700">{task.title}</div>
                      <div className="text-xs text-slate-400">{task.projectName ?? "General"}</div>
                    </button>
                  </td>
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-100 rounded-full h-1.5">
                        <div 
                          className={`${progressBarColor} h-1.5 rounded-full transition-all duration-300`} 
                          style={{ width: `${Math.min(progress, 100)}%` }} 
                        />
                      </div>
                      <span className={`text-xs font-medium ${progressTextColor}`}>{progress}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor.bg} ${statusColor.text}`}>{task.status}</span>
                  </td>
                  <td className="py-4 px-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColor.bg} ${priorityColor.text}`}>{task.priority}</span>
                  </td>
                  <td className="py-4 px-2 text-slate-500">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "Not set"}</td>
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-0.5">
                      <button
                        className="text-cyan-500 bg-cyan-50 hover:text-cyan-500 hover:cursor-pointer hover:bg-cyan-100 rounded-lg inline-flex items-center justify-center"
                        style={{ width: "28px", height: "28px" }}
                        title="View task"
                        onClick={() => onViewTask?.(task)}
                      >
                        <Icon name="view" size={16} />
                      </button>

                      {canEdit && (
                        <button
                          className="p-1 text-amber-500 bg-amber-50 hover:text-amber-700 hover:bg-amber-100 hover:cursor-pointer rounded-lg inline-flex items-center justify-center"
                          style={{ width: "28px", height: "28px" }}
                          title="Edit task"
                          onClick={() => onEditTask?.(task)}
                        >
                          <Icon name="edit" size={16} /> 
                        </button>
                      )}

                      {canDelete && (
                        <button
                          className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg inline-flex items-center justify-center"
                          style={{ width: "28px", height: "28px" }}
                          title="Delete task"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {effectiveTotalCount === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-slate-400 mb-2">
            <Icon name="hi-emoji-sad" size={48} className="mx-auto" />
          </div>
          <p className="text-slate-500 text-sm font-medium">No tasks found</p>
          <p className="text-slate-400 text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      )}

      <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
        <div className="text-sm min-w-50 text-slate-500">
          {effectiveTotalCount === 0
            ? 'No Results'
            : `Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, effectiveTotalCount)} of ${effectiveTotalCount} Results`
          }
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            <Icon name="chevron-left" size={16} />
            Previous
          </button>

          {effectiveTotalPages > 1 && (() => {
            const pages: (number | "...")[] = [];
            pages.push(1);
            if (currentPage > 3) pages.push("...");
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(effectiveTotalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < effectiveTotalPages - 2) pages.push("...");
            if (effectiveTotalPages > 1) pages.push(effectiveTotalPages);
            return pages.map((page, idx) =>
              page === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-slate-400">...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors duration-200 ${currentPage === page
                      ? 'text-white bg-primary border border-primary'
                      : 'text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {page}
                </button>
              )
            );
          })()}

          <button
            className="px-3 py-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === effectiveTotalPages || effectiveTotalCount === 0}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
