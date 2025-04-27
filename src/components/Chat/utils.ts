import { User } from '../../types/User';

export const formatUserName = (user: User | null): string => {
    if (!user) return 'Unknown User';

    // Use displayName if available (might be set from Auth)
    if (user.displayName) {
         const nameParts = user.displayName.trim().split(' ').filter(part => part.length > 0);
         if (nameParts.length >= 2) {
             const firstNameInitial = nameParts[0].charAt(0).toUpperCase();
             const lastName = nameParts[nameParts.length - 1];
             return `${firstNameInitial}. ${lastName}`;
         }
         if (nameParts.length === 1) {
             return nameParts[0];
         }
    }
    // Fallback to name field from Firestore
    if (user.name) {
        const nameParts = user.name.trim().split(' ').filter(part => part.length > 0);
        if (nameParts.length >= 2) {
            const firstNameInitial = nameParts[0].charAt(0).toUpperCase();
            const lastName = nameParts[nameParts.length - 1];
            return `${firstNameInitial}. ${lastName}`;
        }
        if (nameParts.length === 1) {
            return nameParts[0];
        }
    }
    // Fallback logic: Use callsign, then email, then id
    return user.callsign || user.email || user.id || 'Unknown User';
};

export const getAvatarFallback = (user: User | null): string => {
    if (!user) return '?';

    const nameToUse = user.displayName || user.name; // Prioritize displayName

    if (nameToUse) {
        const nameParts = nameToUse.trim().split(' ').filter(part => part.length > 0);
        if (nameParts.length >= 1 && nameParts[0]) {
            return nameParts[0].charAt(0).toUpperCase();
        }
    }
    // Fallback to callsign initial, then email, then ID
    if (user.callsign) {
        return user.callsign.charAt(0).toUpperCase();
    }
    const fallbackChar = user.email?.charAt(0) || user.id?.charAt(0);
    return fallbackChar ? fallbackChar.toUpperCase() : '?';
};
