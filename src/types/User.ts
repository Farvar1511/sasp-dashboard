export interface Task {
  id: string;
  description: string;
  assignedAt: string;
  completed: boolean;
}

export interface User {
  id?: string;
  name: string;
  rank: string;
  email: string;
  tasks: Task[];
}
