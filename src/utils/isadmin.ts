// helpers/isAdmin.ts
import { User } from "../types/User";

export const computeIsAdmin = (user?: User | null): boolean => {
  if (!user) return false;

  // Check if the user has the `isadmin` override key
  if (user.isAdmin === true) return true;

  // Check if the user's role is explicitly set to "admin"
  const roleAdmin = user.role?.toLowerCase() === "admin";

  // Define ranks that qualify as admin
  const adminRanks = [
    "sergeant", // Added
    "staff sergeant", // Added
    "lieutenant",
    "captain",
    "commander",
    "assistant commissioner",
    "deputy commissioner",
    "commissioner",
  ];

  // Check if the user's rank qualifies as admin
  const rankAdmin = user.rank
    ? adminRanks.includes(user.rank.toLowerCase())
    : false;

  // Return true if the user is an admin by role or rank
  return roleAdmin || rankAdmin;
};
