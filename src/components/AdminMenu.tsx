import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import './AdminMenu.css';

interface Task {
  id: string;
  description: string;
  assignedAt: string;
  completed: boolean;
}

interface User {
  email: string;
  name: string;
  rank: string;
  tasks: Task[];
}

interface AdminMenuProps {
  currentUser: User;
}

const AdminMenu: React.FC<AdminMenuProps> = ({ currentUser: _ }) => {
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 🔄 Load users and their tasks
  useEffect(() => {
    const fetchUsers = async (): Promise<void> => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersList: User[] = [];

        for (const docSnap of usersSnap.docs) {
          const data = docSnap.data();
          const user: User = {
            email: docSnap.id,
            name: data.name,
            rank: data.rank,
            tasks: [],
          };

          const tasksSnap = await getDocs(collection(db, 'users', docSnap.id, 'tasks'));
          tasksSnap.forEach((taskDoc) => {
            const taskData = taskDoc.data();
            user.tasks.push({
              id: taskDoc.id,
              description: taskData.description,
              assignedAt: taskData.assignedAt,
              completed: taskData.completed,
            });
          });

          usersList.push(user);
        }

        setUsers(usersList);
      } catch (err) {
        console.error('Failed to load users:', err);
        setError('Failed to load users from Firestore.');
      }
    };

    fetchUsers();
  }, []);

  // 📝 Assign a new task
  const assignTask = async (): Promise<void> => {
    if (!selectedUserId || !taskDescription) {
      alert('Please select a user and enter a task.');
      return;
    }

    const taskId = uuidv4();
    const task: Task = {
      id: taskId,
      description: taskDescription,
      assignedAt: new Date().toISOString(),
      completed: false,
    };

    try {
      const taskRef = doc(db, 'users', selectedUserId, 'tasks', taskId);
      await setDoc(taskRef, task);

      alert('✅ Task assigned!');
      setTaskDescription('');
      setSelectedUserId('');

      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.email === selectedUserId
            ? { ...user, tasks: [...user.tasks, task] }
            : user
        )
      );
    } catch (err) {
      console.error('Failed to assign task:', err);
      setError('Error assigning task.');
    }
  };

  // 🗑️ Delete a completed task
  const deleteTask = async (userEmail: string, taskId: string): Promise<void> => {
    try {
      const taskRef = doc(db, 'users', userEmail, 'tasks', taskId);
      await deleteDoc(taskRef);

      setUsers((prev) =>
        prev.map((user) =>
          user.email === userEmail
            ? {
                ...user,
                tasks: user.tasks.filter((task) => task.id !== taskId),
              }
            : user
        )
      );
    } catch (err) {
      console.error('Failed to delete task:', err);
      alert('Error deleting task');
    }
  };

  if (error) {
    return (
      <div className="error-message">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="sidebar">
        <button className="button-primary" onClick={() => navigate('/')}>Dashboard</button>
        <button className="button-primary" onClick={() => navigate('/tasks')}>Tasks</button>
        <button className="button-primary" onClick={() => navigate('/badge-lookup')}>Badge Lookup</button>
        <button className="button-primary" onClick={() => navigate('/admin-menu')}>Admin Menu</button>
      </div>

      <div className="admin-menu-container">
        <h2>Admin Menu</h2>
        <div className="admin-menu">
          <div>
            <label>
              Select User:
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">--Select User--</option>
                {users.map((user) => (
                  <option key={user.email} value={user.email}>
                    {user.name} ({user.rank})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label>
              Task:
              <input
                type="text"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
              />
            </label>
          </div>
          <button onClick={assignTask}>Assign Task</button>
        </div>

        <div className="user-grid">
          {users.map((user) => (
            <div key={user.email} className="user-task-card">
              <h4>{user.name} ({user.rank})</h4>
              <ul>
                {user.tasks.length > 0 ? (
                  user.tasks.map((task) => (
                    <li
                      key={task.id}
                      className={task.completed ? 'completed' : ''}
                    >
                      {task.description}
                      {!task.completed && (
                        <button onClick={() => deleteTask(user.email, task.id)}>
                          Delete
                        </button>
                      )}
                    </li>
                  ))
                ) : (
                  <li>No tasks assigned</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminMenu;
