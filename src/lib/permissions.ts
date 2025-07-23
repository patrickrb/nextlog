// Role-based access control utilities for Nextlog admin system

export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export enum Permission {
  // User management
  VIEW_USERS = 'view_users',
  CREATE_USERS = 'create_users',
  EDIT_USERS = 'edit_users',
  DELETE_USERS = 'delete_users',
  MANAGE_USER_ROLES = 'manage_user_roles',
  
  // Storage configuration
  VIEW_STORAGE_CONFIG = 'view_storage_config',
  EDIT_STORAGE_CONFIG = 'edit_storage_config',
  
  // System administration
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_SYSTEM = 'manage_system',
  SYSTEM_ADMIN = 'system_admin'
}

// Role-based permissions mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [],
  
  [UserRole.MODERATOR]: [
    Permission.VIEW_USERS,
    Permission.EDIT_USERS,
    Permission.VIEW_AUDIT_LOGS
  ],
  
  [UserRole.ADMIN]: [
    Permission.VIEW_USERS,
    Permission.CREATE_USERS,
    Permission.EDIT_USERS,
    Permission.DELETE_USERS,
    Permission.MANAGE_USER_ROLES,
    Permission.VIEW_STORAGE_CONFIG,
    Permission.EDIT_STORAGE_CONFIG,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_SYSTEM,
    Permission.SYSTEM_ADMIN
  ]
};

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

/**
 * Check if a user can access admin features
 */
export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

/**
 * Check if a user can moderate content/users
 */
export function isModerator(role: UserRole): boolean {
  return role === UserRole.MODERATOR || role === UserRole.ADMIN;
}

/**
 * Check if a user is active and can perform actions
 */
export function isActiveUser(status: UserStatus): boolean {
  return status === UserStatus.ACTIVE;
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Role hierarchy - higher roles include lower role permissions
 */
export const ROLE_HIERARCHY = [UserRole.USER, UserRole.MODERATOR, UserRole.ADMIN];

/**
 * Check if one role is higher than another
 */
export function isHigherRole(role1: UserRole, role2: UserRole): boolean {
  const index1 = ROLE_HIERARCHY.indexOf(role1);
  const index2 = ROLE_HIERARCHY.indexOf(role2);
  return index1 > index2;
}