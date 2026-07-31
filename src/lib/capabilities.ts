/** Every distinct thing a team member can do. Add here first, then grant below. */
export type Capability =
  // Casework — the daily job
  | 'clients:read' | 'clients:write'
  | 'disputes:read' | 'disputes:write'
  | 'letters:write'          // edit THIS dispute's letter text (not the template)
  | 'tasks:read' | 'tasks:write'
  | 'messages:read' | 'messages:write'
  | 'leads:read' | 'leads:write'
  | 'agreements:read' | 'agreements:write'
  | 'billing:client'         // view/charge a specific client
  // Global configuration — one edit affects every client
  | 'templates:read' | 'templates:write'
  | 'content:read' | 'content:write'
  | 'settings:read' | 'settings:write'
  | 'billing:system'
  // Ownership
  | 'team:manage';

export type TeamRole = 'staff' | 'admin' | 'super_admin';
export type AnyRole = TeamRole | 'user' | null;

const STAFF: Capability[] = [
  'clients:read', 'clients:write',
  'disputes:read', 'disputes:write',
  'letters:write',
  'tasks:read', 'tasks:write',
  'messages:read', 'messages:write',
  'leads:read', 'leads:write',
  'agreements:read', 'agreements:write',
  'billing:client',
  'templates:read',
  'content:read',
  'settings:read',
];

const ADMIN: Capability[] = [
  ...STAFF,
  'templates:write',
  'content:write',
  'settings:write',
  'billing:system',
];

const SUPER_ADMIN: Capability[] = [...ADMIN, 'team:manage'];

export const ROLE_CAPABILITIES: Record<TeamRole, Capability[]> = {
  staff: STAFF,
  admin: ADMIN,
  super_admin: SUPER_ADMIN,
};

export function can(role: AnyRole, capability: Capability): boolean {
  if (!role || role === 'user') return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/** True for any role that belongs inside /workspace. */
export function isTeamRole(role: AnyRole): role is TeamRole {
  return role === 'staff' || role === 'admin' || role === 'super_admin';
}
