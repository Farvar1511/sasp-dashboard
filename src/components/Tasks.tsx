import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css'; // Sidebar styles + layout reuse

export default function Tasks() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
            <button className="button-primary" onClick={() => navigate('/badge-lookup')}>Badge Lookup</button> {/* ✅ Added */}
          </>
        )}
      </div>

      {/* Main Page Content */}
      <div className="page-content">
        {/* SASP Logo */}
        <div className="header-stack">
          <img
            src="https://i.gyazo.com/1e84a251bf8ec475f4849db73766eea7.png"
            alt="SASP Logo"
            className="topbar-logo"
          />

          {/* Page Title */}
          <h1 className="title" style={{ marginTop: '1rem' }}>Tasks</h1>
          <p style={{ fontSize: '1.2rem', marginTop: '0.5rem' }}>
            Welcome to the Tasks page. Here you can manage your tasks.
          </p>
        </div>

        {/* Task Content Grid */}
        <div className="link-grid">
          <div className="link-card">
            <h2>Today's Assignments</h2>
            <p style={{ color: '#ccc' }}>No tasks assigned yet.</p>
          </div>
          <div className="link-card">
            <h2>Review Queue</h2>
            <p style={{ color: '#ccc' }}>Nothing to review.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
