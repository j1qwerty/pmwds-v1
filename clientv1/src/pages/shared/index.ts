export { AnimatedBackground } from "./AnimatedBackground";
export { Avatar, AvatarStack, getAvatarUrl } from "./Avatar";
export { GlassCard } from "./GlassCard";
export { GradientButton } from "./GradientButton";

export { ModalOverlay } from "./ModalOverlay";
export { ConfirmDeleteModal } from "./ConfirmDeleteModal";
export { DeleteConfirmationModal } from "./DeleteConfirmationModal";
export { BgControls, BgRenderer, type BgConfig, type BgPreset, DEFAULT_CONFIG } from "./bg/index";
export { InputF } from "./InputF";
export { SelectF } from "./SelectF";
export { OrgFormModal } from "./OrgFormModal";
export { DeptFormModal } from "./DeptFormModal";
export { NavHeaderProvider, useNavHeader } from "./NavHeaderContext";
export { NavHeader, NavActionButton } from "./nav-header";
export { RoleGate, Permission, PERMISSION_GROUPS, ROLE_LEVELS, expandPermissions, usePermission } from "./RoleGate";
export { getProjectDepartmentIds, projectBelongsToDepartment, projectBelongsToAnyDepartment, getProjectDepartments } from "./projectDepartments";
export { LoadingPage, PageSkeleton, Skeleton } from "./Skeleton";
export { NotificationList } from "./NotificationList";
export { UtilizationCertificates } from "./UtilizationCertificates";
export { useToast } from "./Toast";
export { StatusBadge } from "./StatusBadge";
export { PriorityBadge } from "./PriorityBadge";
export { OrganizationDepartmentFilter } from "./OrganizationDepartmentFilter";
export { ScopedUserSelect } from "./ScopedUserSelect";
export { Can, CanAny, CanAll, RoutePermissionGuard } from "./PermissionControls";
export { NoAccessPage } from "./NoAccessPage";
export { OverallProgressRing } from "./OverallProgressRing";

export {
  departmentColorPalette,
  statusColorPalette,
  priorityColorPalette,
  getDepartmentColor,
  getStatusColor,
  getPriorityColor
} from "./colors";
export { StatCard } from "./StatCard";
export { TabButton } from "./TabButton";
export { InfoTip, InfoTipCard, type InfoTipProps } from "./InfoTip";

// New design-system primitives (Phase 2 redesign)
export { Modal, ModalCancelButton, ModalPrimaryButton, ModalDangerButton } from "./Modal";
export { Sheet } from "./Sheet";
export { ViewToggle, type ViewMode } from "./ViewToggle";
export { FilterBar, FilterDropdown, SortDropdown, type FilterChipOption } from "./FilterBar";
export { EmptyState } from "./EmptyState";
export { PageContainer, SectionCard, PageAction } from "./PageContainer";
export { CommandPaletteProvider, useCommandPalette } from "./CommandPaletteContext";
export { CommandPalette, type CommandItem } from "./CommandPalette";

// Phase 5 — hover actions infra
export { HoverActions, type HoverActionDef, type HoverActionsProps } from "./HoverActions";
export {
  ActionVisibilityProvider,
  useActionVisibility,
  ACTION_VISIBILITY_ENTITIES,
  ACTION_VISIBILITY_STORAGE_KEY,
  type ActionVisibilityEntity,
  type ActionVisibilityMode,
  type ActionVisibilitySettings,
} from "./ActionVisibilityContext";

