import { useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function Sidebar({ navigate }: { navigate: (path: string) => void }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();

  const buttons = [
    { label: 'Dashboard', path: '/' },
    { label: 'Tasks', path: '/tasks' },
    { label: 'Badge Lookup', path: '/badge-lookup' },
    { label: 'Everfall Home', path: '/everfall-home' },
    { label: 'Admin Menu', path: '/admin-menu' },
  ];

  return (
    <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      <button className="button-primary" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
        {isSidebarCollapsed ? '☰' : 'Collapse'}
      </button>
      {!isSidebarCollapsed && (
        <>
          {buttons
            .filter((button) => button.path !== location.pathname) // Hide the button for the current page
            .map((button) => (
              <button
                key={button.path}
                className="button-primary"
                onClick={() => navigate(button.path)}
              >
                {button.label}
              </button>
            ))}
          <button
            className="button-primary logout-button"
            onClick={() => {
              navigate('/'); // Navigate to the login page
              window.location.reload(); // Clear user session
            }}
          >
            Logout
          </button>
        </>
      )}
    </div>
  );
}
