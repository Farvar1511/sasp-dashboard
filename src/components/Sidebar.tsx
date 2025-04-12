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
    <div
      className={`sidebar fixed top-0 left-0 h-full bg-black text-white flex flex-col gap-4 p-4 transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-40"
      }`}
    >
      <button
        className="px-4 py-2 rounded-md bg-[#f3c700] text-black font-semibold hover:bg-yellow-300 transition-colors"
        onClick={toggleCollapse}
      >
        {isCollapsed ? "☰" : "Collapse"}
      </button>
      <div className={`${isCollapsed ? "space-y-2" : "space-y-4"}`}>
        {buttons.map((button) =>
          button.path ? (
            button.path !== location.pathname && (
              <button
                key={button.path}
                className={`${
                  isCollapsed ? "text-center text-xs" : "px-4 py-2"
                } rounded-md bg-[#f3c700] text-black font-semibold hover:bg-yellow-300 transition-colors`}
                onClick={() => navigate(button.path)}
              >
                {button.label}
              </button>
            )
          ) : (
            <button
              key={button.label}
              className={`${
                isCollapsed ? "text-center text-xs" : "px-4 py-2"
              } rounded-md bg-[#f3c700] text-black font-semibold hover:bg-yellow-300 transition-colors`}
              onClick={button.action}
            >
              {button.label}
            </button>
          )
        )}
        <button
          className={`${
            isCollapsed ? "text-center text-xs" : "px-4 py-2"
          } rounded-md bg-[#f3c700] text-black font-semibold hover:bg-red-500 transition-colors mt-4`}
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
      </div>
    </div>
  );
}
