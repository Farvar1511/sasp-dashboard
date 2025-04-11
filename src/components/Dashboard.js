import React from 'react';
import AdminMenu from './AdminMenu';

const Dashboard = ({ currentUser }) => {
    return (
        <div className="dashboard">
            {["SSgt.", "Commander", "Captain", "Lieutenant", "Commissioner"].includes(currentUser.rank) && (
                <AdminMenu currentUser={currentUser} />
            )}
        </div>
    );
};

export default Dashboard;