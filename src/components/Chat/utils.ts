import { User } from "../../types/User";

/**
 * Formats a user's name for display.
 * Handles potential null/undefined user or name.
 * Returns "Unknown User" if name is unavailable.
 * Example: John Doe -> John Doe
 */
export const formatUserName = (user?: User | null): string => {
    if (!user || !user.name) {
        return 'Unknown User';
    }
    return user.name;
};

/**
 * Formats a user's name for short display (First Initial. Last Name).
 * Handles potential null/undefined user or name.
 * Returns "Unknown" if name is unavailable or malformed.
 * Example: John Doe -> J. Doe
 */
export const formatUserNameShort = (user?: User | null): string => {
    if (!user || !user.name) {
        return 'Unknown';
    }
    const nameParts = user.name.trim().split(' ');
    if (nameParts.length < 2) {
        // Handle single names or return as is if preferred
        return user.name;
    }
    const firstNameInitial = nameParts[0].charAt(0).toUpperCase();
    const lastName = nameParts[nameParts.length - 1]; // Get the last part as last name
    return `${firstNameInitial}. ${lastName}`;
};


/**
 * Generates fallback initials for an avatar.
 * Handles potential null/undefined user or name.
 * Returns "?" if name is unavailable.
 * Example: John Doe -> JD
 */
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
