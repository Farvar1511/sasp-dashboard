import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './Dashboard.css';

interface Task {
  id: string;
  description: string;
  assignedAt: string;
  completed: boolean;
}

interface User {
  email: string;
}

export default function Tasks({ user }: { user: User }) {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user.email) return;

    const tasksRef = collection(db, 'users', user.email, 'tasks');

    const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
      const tasksList: Task[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        tasksList.push({
          id: doc.id,
          description: data.description,
          assignedAt: data.assignedAt,
          completed: data.completed,
        });
      });
      setTasks(tasksList);
    }, (error) => {
      console.error("Error fetching tasks:", error);
      setError("Failed to load tasks. Please try again later.");
    });

    return () => unsubscribe();
  }, [user.email]);

  const completeTask = async (taskId: string) => {
    try {
      const taskRef = doc(db, 'users', user.email, 'tasks', taskId);
      await updateDoc(taskRef, { completed: true });
    } catch (err) {
      console.error('Error completing task:', err);
      setError("Failed to update task.");
    }
  };

  if (error) {
    return (
      <div className="error-message">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')}>Go Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <button className="button-primary" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
          {isSidebarCollapsed ? '☰' : 'Collapse'}
        </button>
        {!isSidebarCollapsed && (
          <>
            <button className="button-primary" onClick={() => navigate('/')}>Dashboard</button>
            <button className="button-primary" onClick={() => navigate('/tasks')}>Tasks</button>
            <button className="button-primary" onClick={() => navigate('/badge-lookup')}>Badge Lookup</button>
          </>
        )}
      </div>

      {/* Main Content */}
      <div className="page-content">
        <div className="header-stack">
          <img
            src="https://i.gyazo.com/1e84a251bf8ec475f4849db73766eea7.png"
            alt="SASP Logo"
            className="topbar-logo"
          />
          <h1 className="title" style={{ marginTop: '1rem' }}>Tasks</h1>
          <p style={{ fontSize: '1.2rem', marginTop: '0.5rem' }}>
            Welcome to the Tasks page. Here you can manage your tasks.
          </p>
        </div>

        <div className="tasks-page">
          <h2>Your Tasks</h2>
          {tasks.length === 0 ? (
            <p>No tasks assigned.</p>
          ) : (
            <ul>
              {tasks.map(task => (
                <li
                  key={task.id}
                  style={{
                    marginBottom: '10px',
                    textDecoration: task.completed ? 'line-through' : 'none'
                  }}
                >
                  {task.description}
                  {!task.completed && (
                    <button
                      onClick={() => completeTask(task.id)}
                      style={{
                        marginLeft: '10px',
                        backgroundColor: '#222',
                        color: '#FFD700',
                        border: '1px solid #FFD700',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Mark as Completed
                    </button>
                  )}
                  {task.completed && <span> ✅</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
