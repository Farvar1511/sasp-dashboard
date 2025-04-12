export interface Task {
  id: string;
  description: string;
  assignedAt: string;
  completed: boolean;
  type: 'normal' | 'goal-oriented'; // Added task type
  goal?: number; // Optional goal for goal-oriented tasks
  progress?: number; // Optional progress for goal-oriented tasks
}

export interface User {
  id?: string;
  name: string;
  rank: string;
  email: string;
  tasks: Task[];
  isAdmin?: boolean; // Add isAdmin field
}
