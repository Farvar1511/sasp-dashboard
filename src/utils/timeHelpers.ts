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
  try {
    const date =
      timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return "Invalid Date";
  }
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

/**
 * Combines date and time strings for display.
 * @param dateStr - Date string (e.g., "MM/DD/YY").
 * @param timeStr - Time string (e.g., "h:mm AM/PM").
 * @returns Combined string like "MM/DD/YY at h:mm AM/PM" or indicates invalid input.
 */
export const formatIssuedAt = (dateStr: string | null | undefined, timeStr: string | null | undefined): string => {
  const formattedDate = formatDateToMMDDYY(dateStr); // Ensure consistent MM/DD/YY format
  const formattedTime = timeStr; // Assume timeStr is already in desired h:mm AM/PM format

  if (!formattedDate || !formattedTime || formattedDate === "N/A") {
      return "Invalid Date/Time";
  }
  // Validate time format loosely (e.g., contains AM/PM)
  if (!/^\d{1,2}:\d{2}\s(AM|PM)$/i.test(formattedTime)) {
      // If time format is not as expected, maybe just show the date
      // console.warn(`formatIssuedAt received potentially invalid time format: ${timeStr}`);
      // return formattedDate; // Option: just return date if time is bad
      return "Invalid Time Format"; // Option: Indicate error
  }

  return `${formattedDate} at ${formattedTime}`;
};

/**
 * Formats a time string (HH:MM) or a Date object's time part for display with AM/PM.
 * Returns "Invalid Time Format" for invalid input.
 * @param timeValue - The time string (HH:MM) or Date object.
 * @returns A formatted string "h:mm AM/PM" or "Invalid Time Format".
 */
export const formatTimeForDisplay = (
  timeValue: string | Date | null | undefined
): string => {
  if (!timeValue) return "Invalid Time Format";

  try {
    let hours: number, minutes: number;

    if (typeof timeValue === "string") {
      const parts = timeValue.split(":");
      if (parts.length !== 2) return "Invalid Time Format";

      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    } else if (timeValue instanceof Date) {
      hours = timeValue.getHours();
      minutes = timeValue.getMinutes();
    } else {
      return "Invalid Time Format";
    }

    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return "Invalid Time Format";
    }

    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12; // Convert 0 to 12 for 12-hour format
    const minutesPadded = minutes.toString().padStart(2, "0");

    return `${hours}:${minutesPadded} ${ampm}`;
  } catch (error) {
    console.error("Error formatting time for display:", error, timeValue);
    return "Invalid Time Format";
  }
};

/**
 * Formats a Firestore Timestamp or Date object into a string like "MM/DD/YY at h:mm AM/PM".
 * @param ts - The Timestamp or Date object.
 * @param timeStr - Optional time string (HH:MM) to override the time part.
 * @returns A formatted string or "N/A".
 */
export const formatTimestampWithTime = (
  ts: Timestamp | Date | null | undefined,
  timeStr?: string
): string => {
  if (!ts) return "N/A";

  try {
    const date = ts instanceof Timestamp ? ts.toDate() : ts;
    const formattedDate = formatDateToMMDDYY(date);
    const formattedTime = timeStr || formatTimeForDisplay(date);

    if (!formattedDate || !formattedTime) return "N/A";

    return `${formattedDate} at ${formattedTime}`;
  } catch (error) {
    console.error("Error formatting timestamp with time:", error, ts, timeStr);
    return "N/A";
  }
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
 * Calculates the difference in hours between two time strings (HH:MM) on potentially different dates.
 * Handles overnight scenarios.
 * @param dateString - The date string (e.g., "YYYY-MM-DD").
 * @param timeStarted - The start time string (HH:MM).
 * @param timeEnded - The end time string (HH:MM).
 * @returns The difference in hours (float, 1 decimal place) or 0 if invalid.
 */
export const calculateTimeDifference = (
  dateString: string,
  timeStarted: string,
  timeEnded: string
): number => {
  try {
    const startDate = new Date(`${dateString}T${timeStarted}:00`);
    const endDate = new Date(`${dateString}T${timeEnded}:00`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

    let diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    if (diff < 0) {
      diff += 24; // Handle overnight scenarios
    }

    return parseFloat(diff.toFixed(1));
  } catch (error) {
    console.error("Error calculating time difference:", error, dateString, timeStarted, timeEnded);
    return 0;
  }
};

/**
 * Checks if a given date (Timestamp, Date, or string) is older than a specified number of days from today.
 * @param dateValue The date to check.
 * @param days The number of days threshold.
 * @returns True if the date is older than or equal to the threshold, false otherwise or on error.
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
      // Use UTC methods to avoid timezone shifts affecting the date part
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // Pad month
      const day = date.getUTCDate().toString().padStart(2, '0'); // Pad day
      const year = date.getUTCFullYear() % 100; // Get last two digits of year

      // Use local time for the time part with AM/PM
      const options: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };
      const timeString = date.toLocaleTimeString('en-US', options);

      return `${month}/${day}/${year}, ${timeString}`; // MM/DD/YY, h:mm AM/PM
    }
  } catch (error) {
    console.error("Error formatting timestamp:", error, dateValue);
  }

  return "N/A"; // Return N/A if parsing or formatting fails
};

/**
 * Formats only the time part of a Timestamp, Date, or string into h:mm AM/PM format.
 * @param dateValue The date/time value to format.
 * @returns Formatted time string or "N/A".
 */
export const formatTimestampTimeOnly = (
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
      date = new Date(dateValue);
    }

    if (date && !isNaN(date.getTime())) {
      const options: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };
      return date.toLocaleTimeString('en-US', options); // h:mm AM/PM
    }
  } catch (error) {
    console.error("Error formatting time only:", error, dateValue);
  }
  return "N/A";
};

/**
 * Formats only the date part of a Timestamp, Date, or string into MM/DD/YY format.
 * @param dateValue The date/time value to format.
 * @returns Formatted date string or "N/A".
 */
export const formatTimestampDateOnly = (
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
      date = new Date(dateValue);
    }

    if (date && !isNaN(date.getTime())) {
      // Use UTC methods to avoid timezone shifts affecting the date part
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');
      const year = date.getUTCFullYear() % 100;
      return `${month}/${day}/${year}`; // MM/DD/YY
    }
  } catch (error) {
    console.error("Error formatting date only:", error, dateValue);
  }
  return "N/A";
};

/**
 * Formats a date for use as a separator in chat messages (e.g., "Today", "Yesterday", "MM/DD/YY").
 * @param dateValue The Timestamp, Date, or date string to format.
 * @returns A formatted date string for the separator or null if invalid.
 */
export const formatDateSeparator = (
  dateValue: Timestamp | Date | string | null | undefined
): string | null => {
  if (!dateValue) return null;

  let date: Date | null = null;

  try {
    if (dateValue instanceof Timestamp) {
      date = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    }

    if (date && !isNaN(date.getTime())) {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      // Normalize dates to midnight UTC for accurate comparison
      const dateUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      const yesterdayUTC = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()));

      if (dateUTC.getTime() === todayUTC.getTime()) {
        return "Today";
      } else if (dateUTC.getTime() === yesterdayUTC.getTime()) {
        return "Yesterday";
      } else {
        // Use MM/DD/YY format for older dates
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = date.getUTCDate().toString().padStart(2, '0');
        const year = date.getUTCFullYear() % 100;
        return `${month}/${day}/${year}`;
      }
    }
  } catch (error) {
    console.error("Error formatting date separator:", error, dateValue);
  }

  return null; // Return null if formatting fails
};

/**
 * Gets the current date and time formatted as strings.
 * @returns An object with { currentDate: "MM/DD/YY", currentTime: "h:mm AM/PM" }.
 */
export const getCurrentDateTimeStrings = (): { currentDate: string; currentTime: string } => {
    const now = new Date();

    // Format Date: MM/DD/YY
    const month = (now.getMonth() + 1).toString(); // PadStart not needed for MM/DD/YY
    const day = now.getDate().toString();
    const year = now.getFullYear().toString().slice(-2);
    const currentDate = `${month}/${day}/${year}`;

    // Format Time: h:mm AM/PM
    const options: Intl.DateTimeFormatOptions = {
        hour: 'numeric', // h
        minute: '2-digit', // mm
        hour12: true, // AM/PM
    };
    const currentTime = now.toLocaleTimeString('en-US', options);

    return { currentDate, currentTime };
};

/**
 * Converts various date/time representations to a Firestore Timestamp or null.
 * Handles null/undefined, Firestore Timestamps, JS Date objects,
 * and strings (attempts common formats like ISO, MM/DD/YY, YYYY-MM-DD).
 * @param value The value to convert.
 * @returns A Firestore Timestamp or null if conversion fails.
 */
export const convertToTimestampOrNull = (
    value: string | Date | Timestamp | null | undefined
): Timestamp | null => {
    if (value === null || value === undefined) {
        return null;
    }

    let date: Date | null = null;

    try {
        if (value instanceof Timestamp) {
            // If value is a Firestore Timestamp, convert it to a Date object
            date = value.toDate();
        } else if (value instanceof Date) {
            // If value is already a Date object, use it directly
            date = value;
        } else if (typeof value === 'string') {
            // If value is a string, attempt to parse it
            date = new Date(value);
        }

        // Check if the date is valid
        if (date && !isNaN(date.getTime())) {
            // If valid, return as Firestore Timestamp
            return Timestamp.fromDate(date);
        }
    } catch (error) {
        console.error("Error converting to Timestamp:", error, value);
    }

    // If value is null, undefined, or invalid, return null
    return null;
};

/**
 * Formats a date input (string, Date, or Timestamp) into MM/DD/YY format.
 * Returns "N/A" for invalid or null inputs.
 * @param dateInput The date value to format (string, Date, Timestamp, null, or undefined).
 * @returns A string in MM/DD/YY format or "N/A".
 */
export function formatDateToMMDDYY(dateInput: string | Date | Timestamp | null | undefined): string {
  if (!dateInput) return "N/A";

  try {
    // Convert Timestamp to Date if necessary
    const date = dateInput instanceof Timestamp ? dateInput.toDate() : new Date(dateInput);

    if (isNaN(date.getTime())) return "N/A"; // Check if the resulting date is valid

    // Use UTC methods to avoid timezone shifts affecting the date part
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = date.getUTCDate().toString().padStart(2, "0");
    const year = date.getUTCFullYear().toString().slice(-2);

    return `${month}/${day}/${year}`;
  } catch (error) {
    console.error("Error formatting date to MM/DD/YY:", error, dateInput);
    return "N/A";
  }
}

/**
 * Calculates the percentage of time remaining for a task with a due date.
 * Considers an optional start date for the total duration.
 * Returns a value between 0 and 100.
 * Returns 100 if no due date is provided or if start date is after due date.
 * Returns 0 if the due date has passed.
 */
export const calculateTimeRemainingPercentage = (
  startDate: string | null | undefined,
  dueDate: string | null | undefined
): number => {
  if (!dueDate) return 100; // No due date means 100% time remaining

  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize current time to start of day

  const due = new Date(dueDate + 'T00:00:00'); // Assume YYYY-MM-DD format
  if (isNaN(due.getTime())) return 100; // Invalid due date
  due.setHours(23, 59, 59, 999); // Consider the end of the due day

  const start = startDate ? new Date(startDate + 'T00:00:00') : null; // Assume YYYY-MM-DD format
  if (start && isNaN(start.getTime())) return 100; // Invalid start date

  const startTime = start ? start.getTime() : now.getTime(); // Use now if no start date

  if (startTime > due.getTime()) return 100; // Start date is after due date

  const totalDuration = due.getTime() - startTime;
  const timeRemaining = Math.max(0, due.getTime() - now.getTime()); // Don't go below 0

  if (totalDuration <= 0) return now.getTime() > due.getTime() ? 0 : 100; // Avoid division by zero

  const percentage = (timeRemaining / totalDuration) * 100;

  // If due date is past, return 0
  if (now.getTime() > due.getTime()) {
      return 0;
  }

  return Math.min(100, Math.max(0, percentage)); // Clamp between 0 and 100
};

/**
 * Gets the appropriate text color class based on time remaining percentage.
 */
export const getTaskTimeColorClass = (
    percentage: number,
    isPastDue: boolean
): string => {
    if (isPastDue) return 'text-red-500'; // Overdue is always red
    if (percentage <= 25) return 'text-red-500';
    if (percentage <= 50) return 'text-orange-500';
    if (percentage <= 75) return 'text-yellow-500';
    return 'text-gray-300'; // Default color
};

/**
 * Checks if a given due date string (YYYY-MM-DD) is past the current date.
 */
export const isDueDatePast = (dueDate: string | null | undefined): boolean => {
    if (!dueDate) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalize current time to start of day
    const due = new Date(dueDate + 'T00:00:00'); // Assume YYYY-MM-DD format
    if (isNaN(due.getTime())) return false; // Invalid date
    due.setHours(23, 59, 59, 999); // Consider the end of the due day
    return now.getTime() > due.getTime();
};

