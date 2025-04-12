import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react"; // Import useEffect

export default function Layout({
  children,
  user,
}: {
  children: React.ReactNode;
  user: any;
}) {
  const navigate = useNavigate();
  // Initialize state from localStorage, default to true (collapsed) if not found
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState ? JSON.parse(savedState) : true; // Default to collapsed
  });

  // Effect to update localStorage whenever isCollapsed changes
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapse = () => {
    setIsCollapsed((prev: boolean) => !prev); // Toggle based on previous state
    // No need to manually set localStorage here, useEffect handles it
  };

  return (
    <div className="relative min-h-screen">
      {/* Sidebar */}
      <Sidebar
        navigate={navigate}
        user={user}
        isCollapsed={isCollapsed}
        toggleCollapse={toggleCollapse} // Pass toggle function
      />

      {/* Optional: Backdrop for overlay effect ONLY on mobile */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden" // Added md:hidden
          onClick={toggleCollapse} // Close sidebar on backdrop click
        />
      )}

      {/* Main Content */}
      {/* Removed font-orbitron from main layout */}
      <main
        className={`page-content relative z-0 min-h-screen transition-all duration-300 ease-in-out ${
          // Removed font-orbitron
          isCollapsed ? "ml-16" : "ml-40" // Adjust margin based on sidebar state
        }`}
      >
        {children}
      </main>
    </div>
  );
}
