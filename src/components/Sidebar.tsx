import { useState } from 'react';

export default function Sidebar({ navigate }: { navigate: (path: string) => void }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      <button className="button-primary" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
        {isSidebarCollapsed ? '☰' : 'Collapse'}
      </button>
      {!isSidebarCollapsed && (
        <>
          <button className="button-primary" onClick={() => navigate('/')}>Dashboard</button>
          <button className="button-primary" onClick={() => navigate('/tasks')}>Tasks</button>
          <button className="button-primary" onClick={() => navigate('/badge-lookup')}>Badge Lookup</button>
          <button className="button-primary" onClick={() => navigate('/everfall-home')}>Everfall Home</button>
          <button className="button-primary" onClick={() => navigate('/admin')}>Admin Menu</button>
          <button className="button-primary" onClick={() => navigate('/logout')}>Logout</button>
        </>
      )}
    </div>
  );
}
