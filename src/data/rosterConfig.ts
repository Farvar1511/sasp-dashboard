import { Timestamp } from "firebase/firestore";

// Define keys based on the new table structure
export const divisionKeys = ["FTO", "SWAT", "CIU", "K9"];
// Add MBU back based on the requested header
export const certificationKeys = ["HEAT", "MBU", "ACU"];

// Helper function to format Timestamp or string date to MM/DD/YY
export const formatDate = (
  dateValue: string | Timestamp | null | undefined
): string => {
  if (!dateValue) return "-";
  try {
    let date: Date;
    if (dateValue instanceof Timestamp) {
      date = dateValue.toDate();
    } else if (typeof dateValue === "string") {
      // Handle potential timezone issues with YYYY-MM-DD strings
      date = new Date(
        dateValue.includes("T") ? dateValue : dateValue + "T00:00:00"
      );
      if (isNaN(date.getTime())) return "-"; // Invalid date string
    } else {
      return "-";
    }

    return date.toISOString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return "-";
  }
};

// Helper function to format LOA range (Keep for potential future use)
export const formatLoaRange = (
  startDate: Timestamp | string | undefined | null,
  endDate: Timestamp | string | undefined | null
): string => {
  const startStr = formatDate(startDate ?? null);
  const endStr = formatDate(endDate ?? null);

  if (startStr !== "-" && endStr !== "-") {
    return `${startStr} - ${endStr}`;
  } else if (startStr !== "-") {
    return startStr;
  } else if (endStr !== "-") {
    // Technically unusual to have only an end date, but handle it
    return `- ${endStr}`;
  } else {
    return "-";
  }
};

// Add rankOrder, CertStatus, certOptions, getCertStyle
export type CertStatus = "LEAD" | "SUPER" | "CERT" | null;

export const rankOrder: { [key: string]: number } = {
  "Commissioner": 1,
  "Deputy Commissioner": 2,
  "Assistant Commissioner": 3,
  "Commander": 4,
  "Captain": 5,
  "Lieutenant": 6,
  "Staff Sergeant": 7,
  "Sergeant": 8,
  "Corporal": 9,
  "Trooper First Class": 10,
  "Trooper": 11,
  "Cadet": 12,
  "Unknown": 99,
};

export const certOptions: {
  value: CertStatus;
  label: string;
  bgColor: string;
  textColor: string;
}[] = [
  {
    value: null,
    label: "None",
    bgColor: "bg-gray-700",
    textColor: "text-gray-300",
  },
  {
    value: "CERT",
    label: "CERT",
    bgColor: "bg-green-600",
    textColor: "text-white",
  },
  {
    value: "LEAD",
    label: "LEAD",
    bgColor: "bg-blue-600",
    textColor: "text-white",
  },
  {
    value: "SUPER",
    label: "SUPER",
    bgColor: "bg-orange-600",
    textColor: "text-white",
  },
];

export const getCertStyle = (
  status: CertStatus
): { bgColor: string; textColor: string } => {
  return (
    certOptions.find((opt) => opt.value === status) || {
      bgColor: "bg-gray-700",
      textColor: "text-gray-300",
    } // Default style for null or unexpected values
  );
};
