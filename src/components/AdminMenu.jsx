import React, { useState, useEffect } from 'react';

const AdminMenu = ({ currentUser }) => {
    const [users, setUsers] = useState([]);
    const [task, setTask] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        fetch('/users.json')
            .then(response => response.json())
            .then(data => setUsers(data))
            .catch(error => console.error('Error fetching users:', error));
    }, []);

    const assignTask = () => {
        if (!selectedUser || !task) {
            alert('Please select a user and enter a task.');
            return;
        }

        fetch('/assign-task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: selectedUser.id,
                task,
                adminId: currentUser.id,
            }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                } else {
                    alert('Task assigned successfully.');
                    setTask('');
                    setSelectedUser(null);
                }
            })
            .catch(error => console.error('Error assigning task:', error));
    };

    return (
        <div>
            <h2>Admin Menu</h2>
            <div>
                <label>
                    Select User:
                    <select
                        value={selectedUser ? selectedUser.id : ''}
                        onChange={e => {
                            const user = users.find(u => u.id === e.target.value);
                            setSelectedUser(user);
                        }}
                    >
                        <option value="">--Select User--</option>
                        {users.map(user => (
                            <option key={user.id} value={user.id}>
                                {user.name}
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
                        onChange={e => setTask(e.target.value)}
                    />
                </label>
            </div>
            <button onClick={assignTask}>Assign Task</button>
        </div>
    );
};

export default AdminMenu;