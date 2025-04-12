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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="dashboard flex">
      <Sidebar
        navigate={navigate}
        user={user}
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main
        className={`page-content transition-all duration-300 ${
          isSidebarCollapsed ? "ml-16" : "ml-40"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
