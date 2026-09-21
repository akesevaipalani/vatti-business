export type PermissionKey =
  | "canCollectPayments"
  | "canViewCustomers"
  | "canCreateCustomers"
  | "canCreateLoans"
  | "canDisburseLoans"
  | "canViewAllLoans"
  | "canViewAllPartners"
  | "canViewReports"
  | "canManageSettings"
  | "canManageBackups"
  | "canManagePartners";

export const DEFAULT_ADMIN_PERMISSIONS: Record<PermissionKey, boolean> = {
  canCollectPayments: true,
  canViewCustomers: true,
  canCreateCustomers: true,
  canCreateLoans: true,
  canDisburseLoans: true,
  canViewAllLoans: true,
  canViewAllPartners: true,
  canViewReports: true,
  canManageSettings: true,
  canManageBackups: true,
  canManagePartners: true,
};

export const DEFAULT_PARTNER_PERMISSIONS: Record<PermissionKey, boolean> = {
  canCollectPayments: true,
  canViewCustomers: true,
  canCreateCustomers: true,
  canCreateLoans: true,
  canDisburseLoans: false, // Disbursing cash requires Admin approval by default
  canViewAllLoans: true,
  canViewAllPartners: false, // Partner only views their own capital balance
  canViewReports: true, // Daily collection summary
  canManageSettings: false,
  canManageBackups: false,
  canManagePartners: false,
};

export function parsePermissions(rawJson: string | null | undefined, role: string): Record<PermissionKey, boolean> {
  const defaults = role === "ADMIN" ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_PARTNER_PERMISSIONS;
  if (!rawJson) return { ...defaults };
  try {
    const parsed = JSON.parse(rawJson);
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export function hasPermission(
  user: { role?: string; permissions?: Record<string, boolean> | null } | null | undefined,
  permission: PermissionKey
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.permissions && typeof user.permissions[permission] === "boolean") {
    return user.permissions[permission];
  }
  return DEFAULT_PARTNER_PERMISSIONS[permission] ?? false;
}
