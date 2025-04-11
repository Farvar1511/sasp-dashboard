import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminMenu.css';

// Import the shared User and Task interfaces
import { User, Task } from '../types/User';

interface AdminMenuProps {
  currentUser: User;
}

const AdminMenu: React.FC<AdminMenuProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch users from the backend
    axios.get(`${import.meta.env.VITE_API_URL}/api/users`, {
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
    })
      .then((res) => setUsers(res.data))
      .catch((err) => console.error('Error fetching users:', err));
  }, []);

  const assignTask = () => {
    if (!selectedUserId || !taskDescription) {
      alert('Please select a user and enter a task.');
      return;
    }

    axios.post(`${import.meta.env.VITE_API_URL}/api/assign-task`, {
      userId: selectedUserId,
      task: taskDescription,
      adminId: currentUser.email,
    }, {
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
    })
      .then((res) => {
        if (res.data.error) {
          alert(res.data.error);
        } else {
          alert('Task assigned successfully.');
          setTaskDescription('');
          setSelectedUserId('');
          // Update the user's tasks locally
          setUsers((prevUsers) =>
            prevUsers.map((user) =>
              user.email === selectedUserId
                ? { ...user, tasks: [...user.tasks, res.data.task] }
                : user
            )
          );
        }
      })
      .catch((err) => console.error('Error assigning task:', err));
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <button className="button-primary" onClick={() => navigate('/')}>Dashboard</button>
        <button className="button-primary" onClick={() => navigate('/tasks')}>Tasks</button>
        <button className="button-primary" onClick={() => navigate('/badge-lookup')}>Badge Lookup</button>
        <button className="button-primary" onClick={() => navigate('/admin-menu')}>Admin Menu</button>
      </div>

      {/* Admin Menu Content */}
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

        <div className="user-tasks">
          <h3>Users and Their Tasks</h3>
          {users.map((user) => (
            <div key={user.email} className="user-task-card">
              <h4>{user.name} ({user.rank})</h4>
              <ul>
                {user.tasks.length > 0 ? (
                  user.tasks.map((task) => (
                    <li key={task.id} style={{ textDecoration: task.completed ? 'line-through' : 'none' }}>
                      {task.description}
                      {task.completed && <span> ✅</span>}
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
