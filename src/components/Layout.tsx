import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Layout({
  children,
  user,
}: {
  children: React.ReactNode;
  user: any;
}) {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="relative min-h-screen">
      {/* Main Content */}
      <div className="dashboard flex relative z-10">
        <Sidebar
          navigate={navigate}
          user={user}
          isCollapsed={isCollapsed}
          toggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
        <main className={`page-content ${isCollapsed ? "ml-16" : "ml-40"} font-orbitron`}>
          {children}
        </main>
      </div>
    </div>
  );
}
