import { useState } from "react";
import { useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function Sidebar({
  navigate,
  user,
}: {
  navigate: (path: string) => void;
  user?: { rank?: string; isAdmin?: boolean };
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();

  const buttons = [
    { label: "Dashboard", path: "/" },
    { label: "Tasks", path: "/tasks" },
    { label: "Badge Lookup", path: "/badge-lookup" },
    {
      label: "Everfall Home",
      action: () => window.open("https://everfallcommunity.com", "_blank"),
    },
    ...(user?.isAdmin ||
    (user?.rank &&
      ["Staff Sergeant", "SSgt.", "Commander", "Commissioner"].includes(
        user.rank
      ))
      ? [{ label: "Admin Menu", path: "/admin-menu" }]
      : []),
    { label: "Bulletins", path: "/bulletins" },
  ];

  return (
    <div className={`sidebar transition-all duration-300`}>
      <button
        className="button-primary mb-2 hover:bg-yellow-300 transition-colors"
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      >
        {isSidebarCollapsed ? "☰" : "Collapse"}
      </button>
      {!isSidebarCollapsed && (
        <>
          {buttons.map((button) =>
            button.path ? (
              button.path !== location.pathname && (
                <button
                  key={button.path}
                  className="button-primary hover:bg-yellow-300 transition-colors"
                  onClick={() => navigate(button.path)}
                >
                  {button.label}
                </button>
              )
            ) : (
              <button
                key={button.label}
                className="button-primary hover:bg-yellow-300 transition-colors"
                onClick={button.action}
              >
                {button.label}
              </button>
            )
          )}
          <button
            className="button-primary mt-4 hover:bg-red-500 transition-colors"
            onClick={async () => {
              try {
                await signOut(auth);
                navigate("/login");
              } catch (error) {
                console.error("Error logging out:", error);
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
