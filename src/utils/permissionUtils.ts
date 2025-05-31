// Permission utility functions for SASP Dashboard

import { User } from '../types/User'; // Assuming User type path

export function hasAdminPermission(role: string): boolean {
    // Example: Check if role is 'Admin' or 'Superadmin'
    // This function might not be used if relying on certifications for specific modules.
    return ['Admin', 'Superadmin'].includes(role);
}

export function hasFTOAccess(role: string, qualifications?: string[]): boolean {
    // Example: Check for FTO role or specific FTO qualification
    if (role === 'FTO') return true;
    if (qualifications && qualifications.includes('FTO_CERTIFIED')) return true;
    return false;
}

export function hasCIUPermission(role: string, certifications?: Record<string, string | boolean | number>): boolean {
    // Example: Check for general CIU access based on certification
    const ciuCert = certifications?.['CIU'];
    if (typeof ciuCert === 'string') {
        return ['CERT', 'TRAIN', 'LEAD', 'SUPER'].includes(ciuCert.toUpperCase());
    }
    return false;
}

export function isCadet(role: string): boolean {
    return role === 'Cadet';
}

export const canUserManageCiuCaseAssignments = (user: User | null | undefined): boolean => {
    if (!user) return false;
    if (user.certifications && user.certifications['CIU']) {
        const ciuLevel = user.certifications['CIU'];
        if (typeof ciuLevel === 'string') {
            return ['LEAD', 'SUPER'].includes(ciuLevel.toUpperCase());
        }
    }
    // Fallback for users who might have an "Admin" role that supersedes certs
    if (user.role === 'Admin' || user.role === 'Superadmin') return true; 
    return false;
};

export const canUserEditAnyCiuCaseUpdate = (user: User | null | undefined): boolean => {
    // This is similar to managing assignments, typically Lead/Super
    return canUserManageCiuCaseAssignments(user);
};

export const canUserDeleteCiuCase = (user: User | null | undefined, caseCreatedById?: string): boolean => {
    if (!user) return false;
    // Lead/Super can delete any case
    if (canUserManageCiuCaseAssignments(user)) return true;
    // User can delete their own case if they are not Lead/Super (adjust if needed)
    // if (caseCreatedById && user.id === caseCreatedById) return true; // This might be too permissive
    return false; // Default to restrictive
};