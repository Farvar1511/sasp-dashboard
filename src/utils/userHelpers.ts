/**
 * Formats a user's rank and name for display.
 * Example: "Sergeant J. Doe"
 * @param rank - The user's rank.
 * @param name - The user's full name.
 * @returns A formatted string "Rank I. LastName" or "Unknown User" if inputs are invalid.
 */
export function formatDisplayRankName(
  rank?: string | null,
  name?: string | null
): string {
  if (!rank || !name) {
    return "Unknown User";
  }

  const nameParts = name.trim().split(" ");
  if (nameParts.length < 2) {
    // Handle cases with only one name part (e.g., just "John")
    return `${rank} ${nameParts[0]?.[0]?.toUpperCase() || "?"}.`;
  }

  const firstNameInitial = nameParts[0]?.[0]?.toUpperCase() || "?";
  const lastName = nameParts[nameParts.length - 1]; // Get the last part as the last name

  return `${rank} ${firstNameInitial}. ${lastName}`;
}
