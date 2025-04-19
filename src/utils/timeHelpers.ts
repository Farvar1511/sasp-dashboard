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

/**
 * Converts a date string or Timestamp to MM/DD/YY format.
 * Handles 'YYYY-MM-DD' strings or Firestore Timestamps.
 * @param value - The date string ('YYYY-MM-DD'), Timestamp, or null/undefined.
 * @returns A string in MM/DD/YY format or "N/A" if the input is invalid or empty.
 */
export const formatDateToMMDDYY = (
  dateValue: string | Timestamp | null | undefined
): string => {
  let dateString: string | null = null;

  if (!dateValue) return "N/A";

  if (dateValue instanceof Timestamp) {
    // Convert Timestamp to YYYY-MM-DD string
    try {
      dateString = dateValue.toDate().toISOString().split("T")[0];
    } catch (e) {
      console.error("Error converting Timestamp to Date:", e);
      return "Invalid Date";
    }
  } else if (typeof dateValue === 'string') {
    // Assume string is already in YYYY-MM-DD format or similar parseable format
    dateString = dateValue;
  } else {
    return "N/A"; // Should not happen with TS, but good practice
  }

  // Now dateString is guaranteed to be a string or null (if conversion failed)
  if (!dateString) return "Invalid Date";

  // Existing logic to parse YYYY-MM-DD string
  const parts = dateString.split('-');
  if (parts.length !== 3) {
    // Attempt to parse other potential string formats if needed, or return invalid
    const parsedDate = new Date(dateString + 'T00:00:00Z'); // Treat as UTC
     if (isNaN(parsedDate.getTime())) {
        return "Invalid Date Format";
     }
     // If parseable, extract parts using UTC methods
     const year = parsedDate.getUTCFullYear();
     const month = parsedDate.getUTCMonth();
     const day = parsedDate.getUTCDate();
     const displayMonth = month + 1;
     const displayDay = day;
     const displayYear = year % 100;
     return `${displayMonth}/${displayDay}/${displayYear < 10 ? '0' + displayYear : displayYear}`;
  }

  // Create date using UTC values to avoid timezone shifts from YYYY-MM-DD
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);

  // Validate parsed parts
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return "Invalid Date Parts";
  }

  const date = new Date(Date.UTC(year, month, day));

  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }

  // Use UTC methods for formatting
  const displayMonth = date.getUTCMonth() + 1;
  const displayDay = date.getUTCDate();
  const displayYear = date.getUTCFullYear() % 100;

  return `${displayMonth}/${displayDay}/${displayYear < 10 ? '0' + displayYear : displayYear}`;
};

/**
 * Formats a Timestamp or Date object into MM/DD/YY HH:MM AM/PM (Timezone Abbr.) format.
 * @param timestamp - The Timestamp or Date object to format.
 * @returns A formatted string in the user's local time and timezone, or "N/A".
 */
export function formatTimestampForUserDisplay(
  timestamp: Timestamp | Date | null | undefined
): string {
  if (!timestamp) {
    return "N/A";
  }
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);

  // Check for invalid date
  if (isNaN(date.getTime())) {
      return "Invalid Date";
  }

  // Use Intl.DateTimeFormat for robust formatting
  const options: Intl.DateTimeFormatOptions = {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric', // Use numeric for 1-12
    minute: '2-digit',
    hour12: true, // Force 12-hour clock
    timeZoneName: 'short', // Get timezone abbreviation like EST, PST
  };

  try {
    // Replace comma with space for better readability if present
    return new Intl.DateTimeFormat('en-US', options).format(date).replace(',', '');
  } catch (e) {
    console.error("Error formatting timestamp:", e);
    // Fallback to simpler format on error
    return date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

/**
 * Formats a time string (HH:MM) into 12-hour format (H:MM AM/PM).
 * @param timeString - The time string in 24-hour HH:MM format.
 * @returns A formatted string in 12-hour format or the original string if invalid.
 */
export function formatTimeString12hr(timeString: string | null | undefined): string {
    if (!timeString || !/^\d{1,2}:\d{2}$/.test(timeString)) { // Allow H:MM or HH:MM
        return timeString || "N/A"; // Return original or N/A if invalid/empty
    }
    try {
        const [hours, minutes] = timeString.split(':');
        const hoursInt = parseInt(hours, 10);

        if (isNaN(hoursInt) || hoursInt < 0 || hoursInt > 23) {
             return timeString; // Invalid hour
        }

        const ampm = hoursInt >= 12 ? 'PM' : 'AM';
        const hours12 = hoursInt % 12 || 12; // Convert 0 to 12 for 12 AM/PM
        return `${hours12}:${minutes} ${ampm}`;
    } catch (e) {
        console.error("Error formatting time string:", e);
        return timeString; // Return original on error
    }
}
