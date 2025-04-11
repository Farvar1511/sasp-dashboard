import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminMenu = ({ currentUser }) => {
    const [users, setUsers] = useState([]);
    const [task, setTask] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');

    useEffect(() => {
        // Fetch users from the backend
        axios.get(`${import.meta.env.VITE_API_URL}/users.json`, {
            headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
        })
            .then((res) => setUsers(res.data))
            .catch((err) => console.error('Error fetching users:', err));
    }, []);

    const assignTask = () => {
        if (!selectedUserId || !task) {
            alert('Please select a user and enter a task.');
            return;
        }

        axios.post(`${import.meta.env.VITE_API_URL}/assign-task`, {
            userId: selectedUserId,
            task,
            adminId: currentUser.id,
        }, {
            headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
        })
            .then((res) => {
                if (res.data.error) {
                    alert(res.data.error);
                } else {
                    alert('Task assigned successfully.');
                    setTask('');
                    setSelectedUserId('');
                }
            })
            .catch((err) => console.error('Error assigning task:', err));
    };

    return (
        <div className="admin-menu">
            <h2>Admin Menu</h2>
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
                        value={task}
                        onChange={(e) => setTask(e.target.value)}
                    />
                </label>
            </div>
            <button onClick={assignTask}>Assign Task</button>
        </div>
    );
};

export default AdminMenu;