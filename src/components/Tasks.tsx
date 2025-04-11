import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  const [error, setError] = useState<string | null>(null); // Add error state

  useEffect(() => {
    // Fetch tasks for the logged-in user
    axios.get(`${import.meta.env.VITE_API_URL}/api/users`, {
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
    })
      .then((res) => {
        const currentUser = res.data.find((u: User) => u.email === user.email);
        if (currentUser && Array.isArray(currentUser.tasks)) {
          setTasks(currentUser.tasks);
        } else {
          setTasks([]); // Ensure tasks is always an array
        }
      })
      .catch((err) => {
        console.error('Error fetching tasks:', err);
        setError('Failed to load tasks. Please try again later.');
      });
  }, [user]);

  const completeTask = (taskId: string) => {
    axios.post(`${import.meta.env.VITE_API_URL}/api/complete-task`, {
      userId: user.email,
      taskId,
    }, {
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
    })
      .then(() => {
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === taskId ? { ...task, completed: true } : task
          )
        );
      })
      .catch((err) => {
        console.error('Error completing task:', err);
        setError('Failed to complete the task. Please try again later.');
      });
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

      {/* Main Page Content */}
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

        {/* Task Content */}
        <div className="tasks-page">
          <h2>Your Tasks</h2>
          <ul>
            {tasks.map((task) => (
              <li key={task.id} style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>
                {task.description}
                {!task.completed && (
                  <button onClick={() => completeTask(task.id)}>Mark as Completed</button>
                )}
                {task.completed && <span> ✅</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
