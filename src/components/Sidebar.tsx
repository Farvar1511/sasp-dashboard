import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase'; // Import Firebase auth

export default function Sidebar({ navigate, user }: { navigate: (path: string) => void; user?: { rank?: string } }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();

  const buttons = [
    { label: 'Dashboard', path: '/' },
    { label: 'Tasks', path: '/tasks' },
    { label: 'Badge Lookup', path: '/badge-lookup' },
    {
      label: 'Everfall Home',
      action: () => window.open('https://everfallcommunity.com', '_blank'), // Open in new tab
    },
    // Only show Admin Menu if the user has the appropriate rank
    ...(user?.rank && ['Staff Sergeant', 'SSgt.', 'Commander', 'Commissioner'].includes(user.rank)
      ? [{ label: 'Admin Menu', path: '/admin-menu' }]
      : []),
  ];

  return (
    <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      <button className="button-primary" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
        {isSidebarCollapsed ? '☰' : 'Collapse'}
      </button>
      {!isSidebarCollapsed && (
        <>
          {buttons.map((button) =>
            button.path ? (
              button.path !== location.pathname && (
                <button
                  key={button.path}
                  className="button-primary"
                  onClick={() => navigate(button.path)}
                >
                  {button.label}
                </button>
              )
            ) : (
              <button
                key={button.label}
                className="button-primary"
                onClick={button.action}
              >
                {button.label}
              </button>
            )
          )}
          <button
            className="button-primary logout-button"
            onClick={async () => {
              try {
                await signOut(auth); // Sign out the user from Firebase Authentication
                navigate('/login'); // Redirect to the login page
              } catch (error) {
                console.error('Error logging out:', error);
              }
            }}
          >
            Logout
          </button>
        </>
      )}
    </div>
  );
}
