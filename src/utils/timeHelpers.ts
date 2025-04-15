import { Timestamp } from "firebase/firestore";

/**
 * Formats a Date object into MM/DD/YY format.
 * @param date - The Date object to format.
 * @returns A string in MM/DD/YY format or null if the input is null.
 */
export const formatDateToShort = (date: Date | null): string | null => {
  if (!date) return null;
  const month = date.getMonth() + 1; // Months are zero-based
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2); // Get last two digits of the year
  return `${month}/${day}/${year}`;
};

/**
 * Converts a Date object to a short time format (e.g., "8:31 AM EST 1/24/25").
 * @param date - The Date object to convert.
 * @returns A formatted string in the desired short time format.
 */
export const formatAssignedAt = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  };
  return date.toLocaleString("en-US", options);
};

/**
 * Formats a Firestore Timestamp for display.
 * @param timestamp - The Timestamp or Date object to format.
 * @returns A formatted string in the desired display format or "N/A" if the input is null or undefined.
 */
export function formatTimestampForDisplay(
  timestamp: Timestamp | Date | null | undefined
): string {
  if (!timestamp) {
    return "N/A";
  }
  const date =
    timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const formatIssuedAt = (dateStr: string, timeStr: string): string => {
  if (!dateStr || !timeStr) return "Invalid Date/Time";
  return `${dateStr} at ${timeStr}`;
};

export function showTime(): { day: string; date: string; time: string } {
  const now = new Date();
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const day = days[now.getDay()];
  const date = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return { day, date, time };
}

/**
 * Converts a date string in YYYY-MM-DD format to MM/DD/YY format.
 * @param dateString - The date string in YYYY-MM-DD format.
 * @returns A string in MM/DD/YY format or "Invalid Date" if the input is invalid.
 */
export const convertFirestoreDate = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Invalid Date";
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
};
