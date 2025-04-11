import React, { useState, useEffect } from 'react';

const AdminMenu = ({ currentUser }) => {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [task, setTask] = useState("");
    const [view, setView] = useState("assignTask"); // Default view

    useEffect(() => {
        fetch('/users.json')
            .then(res => res.json())
            .then(data => setUsers(data));
    }, []);

    const assignTask = () => {
        fetch('/assign-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: selectedUser,
                task,
                adminId: currentUser.id
            })
        })
            .then(res => res.json())
            .then(data => alert(data.message || data.error));
    };

    return (
        <div className="admin-menu">
            <h2>Admin Menu</h2>
            <div className="menu-options">
                <button onClick={() => setView("assignTask")}>Assign Task</button>
                <button onClick={() => setView("viewUsers")}>View Users</button>
                <button onClick={() => setView("manageTasks")}>Manage Tasks</button>
            </div>

            {view === "assignTask" && (
                <div className="assign-task">
                    <h3>Assign Task</h3>
                    <select onChange={e => setSelectedUser(e.target.value)}>
                        <option value="">Select User</option>
                        {users.map(user => (
                            <option key={user.id} value={user.id}>
                                {user.name} ({user.rank})
                            </option>
                        ))}
                    </select>
                    <input
                        type="text"
                        placeholder="Enter task"
                        value={task}
                        onChange={e => setTask(e.target.value)}
                    />
                    <button onClick={assignTask}>Assign Task</button>
                </div>
            )}

            {view === "viewUsers" && (
                <div className="view-users">
                    <h3>User List</h3>
                    <ul>
                        {users.map(user => (
                            <li key={user.id}>
                                {user.name} - {user.rank}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {view === "manageTasks" && (
                <div className="manage-tasks">
                    <h3>Manage Tasks</h3>
                    <p>Feature under development...</p>
                </div>
            )}
        </div>
    );
};

export default AdminMenu;