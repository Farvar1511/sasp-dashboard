import { Timestamp } from 'firebase/firestore';

export interface CadetLog {
  id?: string;
  cadetName: string;
  date: string;
  timeStarted: string;
  timeEnded: string;
  sessionHours: number;
  cumulativeHours: number;
  ftoName: string;
  summary: string;
  additionalNotes: string;
  createdAt?: Timestamp;
  type?: "session" | "progress_update";
  progressSnapshot?: { [key in ProgressItemKey]: boolean };
}

export const progressItems = {
  hoursComplete: "Complete 20 hours of direct training",
  bcBankPrimary: "Primary one Blaine County Bank",
  pacificBankPrimary: "Primary one Pacific Standard Bank",
  heistPrimary: "Primary one of these heists (Bobcat, LSIA, Fleeca)",
  tenEightyPrimary: "Primary in 10-80 with callouts",
  blsComplete: "Complete BLS Training and perform BLS",
  classroomComplete: "Complete SASP Classroom Training",
};
export type ProgressItemKey = keyof typeof progressItems;
export const totalProgressItems = Object.keys(progressItems).length;
export const initialProgressState: { [key in ProgressItemKey]: boolean } = Object.keys(progressItems).reduce(
  (acc, key) => {
    acc[key as ProgressItemKey] = false;
    return acc;
  },
  {} as { [key in ProgressItemKey]: boolean }
);

export type FtoTabKey = "home" | "announcements" | "add" | "logs" | "progress" | "personnel" | "graduated";
export type CadetTabKey = "home";
