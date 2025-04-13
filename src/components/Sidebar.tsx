import { useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function Sidebar({
  navigate,
  user,
  isCollapsed,
  toggleCollapse,
}: {
  navigate: (path: string) => void;
  user?: { rank?: string; isAdmin?: boolean };
  isCollapsed: boolean;
  toggleCollapse: () => void;
}) {
  const location = useLocation();

  const buttons = [
    { label: "Dashboard", path: "/" },
    { label: "Tasks", path: "/tasks" },
    { label: "Badge Lookup", path: "/badge-lookup" },
    ...(user?.isAdmin === true
      ? [{ label: "Admin Menu", path: "/admin" }]
      : []),
    { label: "Bulletins", path: "/bulletins" },
  ];

  return (
    // Apply higher z-index (z-30) and ensure width transitions correctly
    <div
      className={`fixed top-0 left-0 h-full bg-black text-yellow-400 flex flex-col gap-4 p-4 transition-all duration-300 ease-in-out z-30 ${
        // Use z-30 for highest layer
        isCollapsed ? "w-16" : "w-40"
      }`}
    >
      {/* Toggle Button - Always visible */}
      <button
        className="w-full px-2 py-2 rounded-md bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition flex items-center justify-center" // Already centered
        onClick={toggleCollapse}
      >
        {isCollapsed ? "☰" : "Collapse"}
      </button>

      {/* Navigation Links - Hidden when collapsed */}
      <div
        className={`flex-grow flex flex-col ${
          isCollapsed ? "hidden" : "space-y-4"
        }`}
      >
        {buttons.map((button) =>
          button.path
            ? button.path !== location.pathname && (
                <button
                  key={button.path}
                  // Removed text-left, added text-center, flex, justify-center, items-center
                  className="w-full px-4 py-2 rounded-md bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition text-center flex justify-center items-center"
                  onClick={() => {
                    navigate(button.path);
                  }}
                >
                  {button.label}
                </button>
              )
            : null
        )}
        {/* Spacer to push logout to bottom */}
        <div className="flex-grow"></div>
        {/* Everfall Community Link */}
        <a
          href="https://everfallcommunity.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full px-4 py-2 rounded-md bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition text-center flex justify-center items-center"
          title="Everfall Community" // Add title for accessibility
        >
          {/* Replace text with image */}
          <img
            src="/everfall.webp" // Path relative to the public folder
            alt="Everfall Community"
            className="h-4 w-auto" // Adjusted height from h-5 to h-4
          />
        </a>
        {/* Logout Button */}
        <button
          // Added text-center, flex, justify-center, items-center
          className="w-full px-4 py-2 rounded-md bg-yellow-400 text-black font-bold hover:bg-red-500 transition mt-auto text-center flex justify-center items-center"
          onClick={async () => {
            try {
              await signOut(auth);
              // Navigation to /login should happen automatically via App.tsx's auth listener
            } catch (error) {
              console.error("Error logging out:", error);
            }
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
