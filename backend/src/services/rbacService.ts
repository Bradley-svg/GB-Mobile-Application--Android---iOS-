import type { UserRole } from '../repositories/usersRepository';

type RoleInput = { role?: UserRole | string } | null | undefined;

function resolveRole(user: RoleInput): UserRole {
  const role = user?.role;
  if (role === 'owner' || role === 'admin' || role === 'facilities' || role === 'contractor') {
    return role;
  }
  return 'contractor';
}

function hasRole(user: RoleInput, allowed: UserRole[]) {
  const role = resolveRole(user);
  return allowed.includes(role);
}

export function isOwner(user: RoleInput) {
  return resolveRole(user) === 'owner';
}

export function isAdmin(user: RoleInput) {
  return resolveRole(user) === 'admin';
}

export function isFacilities(user: RoleInput) {
  return resolveRole(user) === 'facilities';
}

export function isContractor(user: RoleInput) {
  return resolveRole(user) === 'contractor';
}

export function canControlDevice(user: RoleInput) {
  return hasRole(user, ['owner', 'admin', 'facilities']);
}

export function canEditSchedules(user: RoleInput) {
  return hasRole(user, ['owner', 'admin']);
}

export function canManageWorkOrders(user: RoleInput) {
  return hasRole(user, ['owner', 'admin', 'facilities']);
}

export function canViewMaintenance(user: RoleInput) {
  return hasRole(user, ['owner', 'admin', 'facilities', 'contractor']);
}

export function canConfigureRules(user: RoleInput) {
  return hasRole(user, ['owner', 'admin']);
}

export function canUploadDocuments(user: RoleInput) {
  return hasRole(user, ['owner', 'admin', 'facilities']);
}

export function canShareReadOnly(user: RoleInput) {
  return hasRole(user, ['owner', 'admin', 'facilities']);
}

export function canExportData(user: RoleInput) {
  return hasRole(user, ['owner', 'admin', 'facilities', 'contractor']);
}
