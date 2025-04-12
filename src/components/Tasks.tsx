import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Layout from './Layout';

interface Task {
  id: string;
  description: string;
  assignedAt: string;
  completed: boolean;
  type?: string;
  progress?: number;
  goal?: number;
}

interface User {
  email: string;
}

export default function Tasks({ user }: { user: User }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user.email) return;

    const tasksRef = collection(db, 'users', user.email, 'tasks'); // Fetch tasks for the logged-in user

    const unsubscribe = onSnapshot(
      tasksRef,
      (snapshot) => {
        const tasksList: Task[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          tasksList.push({
            id: doc.id,
            description: data.description,
            assignedAt: data.assignedAt,
            completed: data.completed,
            type: data.type,
            progress: data.progress,
            goal: data.goal,
          });
        });
        setTasks(tasksList);
      },
      (error) => {
        console.error('Error fetching tasks:', error);
        setError('Failed to load tasks. Please try again later.');
      }
    );

    return () => unsubscribe();
  }, [user.email]);

  const completeTask = async (taskId: string) => {
    try {
      const taskRef = doc(db, 'users', user.email, 'tasks', taskId);
      await updateDoc(taskRef, { completed: true });
    } catch (err) {
      console.error('Error completing task:', err);
      setError('Failed to update task.');
    }
  };

  const updateTaskDescription = async (taskId: string, newDescription: string) => {
    try {
      const taskRef = doc(db, 'users', user.email, 'tasks', taskId);
      await updateDoc(taskRef, { description: newDescription });
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Failed to update task.');
    }
  };

  const incrementProgress = async (taskId: string, currentProgress: number, goal: number) => {
    if (currentProgress >= goal) return;

    try {
      const taskRef = doc(db, 'users', user.email, 'tasks', taskId);
      await updateDoc(taskRef, { progress: currentProgress + 1 });

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, progress: currentProgress + 1 } : task
        )
      );
    } catch (err) {
      console.error('Error updating progress:', err);
      setError('Failed to update progress.');
    }
  };

  if (error) {
    return (
      <Layout>
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="header-stack">
        <h1 className="title" style={{ marginTop: '1rem' }}>Tasks</h1>
        <p style={{ fontSize: '1.2rem', marginTop: '0.5rem' }}>
          Welcome to the Tasks page. Here you can manage your tasks.
        </p>
      </div>
      <div className="tasks-grid">
        {tasks.map((task) => (
          <div key={task.id} className="task-card">
            <h3>{task.description}</h3>
            <p>Assigned At: {new Date(task.assignedAt).toLocaleString()}</p>
            {task.type === 'goal-oriented' && (
              <div>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${(task.progress! / task.goal!) * 100}%` }}
                  ></div>
                </div>
                <p>
                  {task.progress}/{task.goal}
                </p>
                <button onClick={() => incrementProgress(task.id, task.progress!, task.goal!)}>
                  ➕ Increment Progress
                </button>
              </div>
            )}
            {!task.completed && task.type !== 'goal-oriented' && (
              <button onClick={() => completeTask(task.id)}>Mark as Completed</button>
            )}
            {task.completed && <span>✅ Completed</span>}
          </div>
        ))}
      </div>
    </Layout>
  );
}
