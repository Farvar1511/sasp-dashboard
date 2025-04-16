import { CertStatus } from "../types/User";

// In Firestore, all the following keys ("ACU", "CIU", "FTO", "HEAT", "K9", "MBU", "SWAT")
// are stored within the 'certifications' map for each user.
// However, for logical separation within the application, we categorize them:

// Certifications (represent specific qualifications)
export const certificationKeys: string[] = ["ACU", "HEAT", "MBU"];

// Divisions (represent assignment to a specific unit)
export const divisionKeys: string[] = ["CIU", "FTO", "K9", "SWAT"];

// Combined list of all keys found in the Firestore 'certifications' map.
export const allCertKeys: string[] = [...certificationKeys, ...divisionKeys];

// A helper to return the proper styling based on a certification status value.
export const getCertStyle = (status: CertStatus | null) => {
  switch (status) {
    case "LEAD":
      return { bgColor: "bg-blue-600", textColor: "text-white" };
    case "SUPER":
      return { bgColor: "bg-orange-600", textColor: "text-white" };
    case "CERT":
      return { bgColor: "bg-green-600", textColor: "text-white" };
    case "TRAIN":
      return { bgColor: "bg-orange-600", textColor: "text-white" };
    default:
      return { bgColor: "bg-gray-600", textColor: "text-gray-300" };
  }
};
