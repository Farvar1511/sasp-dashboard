// Permission utility functions for SASP Dashboard

export function hasAdminPermission(role: string): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function hasFTOAccess(role: string, qualifications?: string[]): boolean {
  return role === 'fto' || !!(qualifications && qualifications.includes('FTO'));
}

export function hasCIUPermission(role: string): boolean {
  return role === 'ciu' || role === 'admin';
}

export function isCadet(role: string): boolean {
  return role === 'cadet';
}