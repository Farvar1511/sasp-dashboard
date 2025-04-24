import { CertStatus } from "../types/User";

// Define the default structure for certifications for a new user
export const defaultCertifications: { [key: string]: CertStatus | null } = {
  FTO: null,
  SWAT: null,
  CIU: null,
  K9: null,
  HEAT: null,
  MBU: null,
  ACU: null,
  // Add any other standard certifications here and set to null
};
