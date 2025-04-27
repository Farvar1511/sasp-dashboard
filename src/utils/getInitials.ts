
export function getInitials(name?: string | null): string {
    if (!name) {
      return "?";
    }
    const nameParts = name.trim().split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) {
      return "?";
    }
    if (nameParts.length === 1) {
      return nameParts[0][0].toUpperCase();
    }
    // Use first and last name initials
    const firstInitial = nameParts[0][0];
    const lastInitial = nameParts[nameParts.length - 1][0];
    return `${firstInitial}${lastInitial}`.toUpperCase();
  }
