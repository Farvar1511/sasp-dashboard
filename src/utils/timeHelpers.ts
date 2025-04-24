import { Timestamp } from "firebase/firestore";

/**
 * Formats a 24-hour time string (HH:MM) into a 12-hour format (h:mm AM/PM).
 * Returns "Invalid Time" for invalid input.
 * @param timeString - The time string in HH:MM format.
 * @returns A string in h:mm AM/PM format or "Invalid Time".
 */
export const formatTime12hr = (timeString: string | null | undefined): string => {
  if (!timeString || typeof timeString !== 'string' || !/^\d{2}:\d{2}$/.test(timeString)) {
    // console.warn("Invalid time string format received:", timeString);
    return ""; // Return empty string for invalid or missing input
  }

  try {
    const [hoursStr, minutesStr] = timeString.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      // console.warn("Invalid time values:", timeString);
      return ""; // Return empty string for invalid time values
    }

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'

    const minutesPadded = minutes < 10 ? '0' + minutes : minutes;

    return `${hours}:${minutesPadded} ${ampm}`;
  } catch (error) {
    console.error("Error formatting time to 12hr:", error, "Input:", timeString);
    return ""; // Return empty string on unexpected error
  }
};


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

/**
 * Formats a date value (Timestamp, Date, string, null, undefined) into MM/DD/YY format.
 * Handles common date string formats like YYYY-MM-DD and MM/DD/YYYY.
 * Returns "N/A" for invalid or null inputs.
 * @param dateValue - The date value to format.
 * @returns A formatted string "MM/DD/YY" or "N/A".
 */
export const formatDateForDisplay = (
  dateValue: Timestamp | Date | string | null | undefined
): string => {
  if (!dateValue) {
    return "N/A";
  }

  try {
    let date: Date;

    if (dateValue instanceof Timestamp) {
      date = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === "string") {
      // Attempt to parse common string formats, treating as UTC to avoid timezone shifts
      const cleanedString = dateValue.trim();
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanedString)) { // YYYY-MM-DD
        date = new Date(cleanedString + 'T00:00:00Z');
      } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleanedString)) { // MM/DD/YY or MM/DD/YYYY
         const parts = cleanedString.split('/');
         if (parts.length === 3) {
            const month = parseInt(parts[0], 10) - 1;
            const day = parseInt(parts[1], 10);
            let year = parseInt(parts[2], 10);
            if (year < 100) { year += 2000; } // Handle YY format
            if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
                 date = new Date(Date.UTC(year, month, day));
            } else {
                 return "N/A"; // Invalid parts
            }
         } else {
             return "N/A"; // Invalid format
         }
      } else {
         // Try direct parsing as a last resort (might be timezone-dependent)
         date = new Date(cleanedString);
      }
    } else {
      return "N/A"; // Unsupported type
    }

    // Check if date is valid after parsing attempts
    if (!date || isNaN(date.getTime())) {
      return "N/A";
    }

    // Format using UTC methods: MM/DD/YY (with padding for month/day)
    const displayMonth = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const displayDay = date.getUTCDate().toString().padStart(2, '0');
    const displayYear = (date.getUTCFullYear() % 100).toString().padStart(2, '0'); // Get last two digits

    return `${displayMonth}/${displayDay}/${displayYear}`;

  } catch (error) {
    console.error("Error formatting date for display:", error, "Input:", dateValue);
    return "N/A"; // Return N/A on any error
  }
};

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
 * Formats a date string (YYYY-MM-DD or MM/DD/YY), Timestamp, or Date object to MM/DD/YY format.
 * Returns an empty string "" for invalid, null, undefined, or empty inputs.
 * @param dateValue - The date value (string, Timestamp, Date, null, undefined).
 * @returns A string in MM/DD/YY format or "".
 */
export const formatDateToMMDDYY = (
  dateValue: string | Timestamp | Date | null | undefined
): string => {
  // Handle null, undefined, or empty/whitespace strings first
  if (!dateValue || (typeof dateValue === 'string' && !dateValue.trim())) {
    return "";
  }

  let date: Date | null = null;

  try {
    if (dateValue instanceof Timestamp) {
      date = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      const cleanedString = dateValue.trim();

      // Try parsing YYYY-MM-DD
      const ymdParts = cleanedString.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (ymdParts) {
        const year = parseInt(ymdParts[1], 10);
        const month = parseInt(ymdParts[2], 10) - 1; // Month is 0-indexed
        const day = parseInt(ymdParts[3], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          // Use UTC to avoid timezone shifts
          date = new Date(Date.UTC(year, month, day));
          // Validate the constructed date
          if (isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
            console.warn(`Invalid date parts in YYYY-MM-DD string: ${cleanedString}`);
            date = null; // Mark as invalid
          }
        }
      }

      // If YYYY-MM-DD parsing failed or wasn't the format, try MM/DD/YY(YY)
      if (!date) {
        const mdyParts = cleanedString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
        if (mdyParts) {
          const month = parseInt(mdyParts[1], 10) - 1; // Month is 0-indexed
          const day = parseInt(mdyParts[2], 10);
          let year = parseInt(mdyParts[3], 10);
          if (year < 100) { year += 2000; } // Handle YY

          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            // Use UTC to avoid timezone shifts
            date = new Date(Date.UTC(year, month, day));
            // Validate the constructed date
            if (isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
              console.warn(`Invalid date parts in MM/DD/YY string: ${cleanedString}`);
              date = null; // Mark as invalid
            }
          }
        }
      }

      // If still no valid date after trying both formats
      if (!date) {
          console.warn(`Unrecognized or invalid date string format: ${cleanedString}`);
          return ""; // Return empty string for unparseable formats
      }
    }

    // If we have a date object, but it's invalid (e.g., from new Date(invalid_string))
    if (date && isNaN(date.getTime())) {
      console.warn(`Invalid Date object received or created.`);
      return "";
    }

    // If date is null after all checks (e.g., invalid parts), return empty string
    if (!date) {
        return "";
    }

    // Format valid date using UTC methods: MM/DD/YY (with padding for year)
    const displayMonth = (date.getUTCMonth() + 1).toString();
    const displayDay = date.getUTCDate().toString();
    const displayYear = (date.getUTCFullYear() % 100).toString().padStart(2, '0');

    return `${displayMonth}/${displayDay}/${displayYear}`;

  } catch (error) {
    console.error("Error formatting date to MM/DD/YY:", error, "Input:", dateValue);
    return ""; // Return empty string on any unexpected error
  }
};

/**
 * Checks if a given date value is older than a specified number of days from now.
 * Handles Timestamps, Date objects, and common date strings (YYYY-MM-DD, M/D/YY, MM/DD/YYYY).
 * @param dateValue The date to check (Timestamp, Date, string, null, undefined).
 * @param days The number of days threshold.
 * @returns True if the date is older than the specified number of days, false otherwise or if invalid.
 */
export const isOlderThanDays = (
  dateValue: string | Timestamp | Date | null | undefined,
  days: number
): boolean => {
  if (!dateValue) return false;

  let promotionDate: Date | null = null;

  try {
    if (dateValue instanceof Timestamp) {
      promotionDate = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      promotionDate = dateValue;
    } else if (typeof dateValue === "string") {
      const cleanedString = dateValue.trim();
      let parsedDate: Date | null = null;

      // Try YYYY-MM-DD (treat as UTC)
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanedString)) {
        parsedDate = new Date(cleanedString + 'T00:00:00Z');
      }
      // Try M/D/YY or MM/DD/YYYY (construct as UTC)
      else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleanedString)) {
        const parts = cleanedString.split('/');
        if (parts.length === 3) {
          const month = parseInt(parts[0], 10) - 1;
          const day = parseInt(parts[1], 10);
          let year = parseInt(parts[2], 10);
          if (year < 100) year += 2000; // Assume 21st century for YY
          if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
            parsedDate = new Date(Date.UTC(year, month, day));
          }
        }
      }
      // Fallback parsing attempt (treat as UTC)
      else {
         parsedDate = new Date(cleanedString + 'T00:00:00Z');
      }

      if (parsedDate && !isNaN(parsedDate.getTime())) {
        promotionDate = parsedDate;
      }
    }

    if (!promotionDate || isNaN(promotionDate.getTime())) {
      // console.warn("Could not parse date for promotion check:", dateValue);
      return false;
    }

    const now = new Date();
    // Calculate the threshold date by subtracting days from the current date
    const thresholdDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Compare the promotion date with the threshold date
    // Ensure comparison happens at the date level (ignore time part if needed, though UTC helps)
    // We check if the promotion date is *before or on* the threshold date
    return promotionDate.getTime() <= thresholdDate.getTime();

  } catch (error) {
    console.error("Error checking date age:", error, "Input:", dateValue);
    return false;
  }
};

/**
 * Formats a Firestore Timestamp, Date object, or date string into MM/DD/YY, HH:MM AM/PM format.
 * @param dateValue The date/time value to format.
 * @returns Formatted date/time string or "N/A".
 */
export const formatTimestampDateTime = (
  dateValue: Timestamp | Date | string | null | undefined
): string => {
  if (!dateValue) return "N/A";

  let date: Date | null = null;

  try {
    if (dateValue instanceof Timestamp) {
      date = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue); // Attempt to parse string
    }

    if (date && !isNaN(date.getTime())) {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear() % 100; // Get last two digits of year

      const options: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };
      const timeString = date.toLocaleTimeString('en-US', options);

      return `${month}/${day}/${year}, ${timeString}`;
    }
  } catch (error) {
    console.error("Error formatting timestamp:", error, dateValue);
  }

  return "N/A"; // Return N/A if parsing or formatting fails
};
