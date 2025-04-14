import React from "react"; // Removed useState
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FaHome,
  FaUsers,
  FaCar,
  FaIdBadge,
  FaSignOutAlt,
  FaUserCircle,
  FaChevronLeft,
  FaChevronRight,
  FaTools,
  FaBullhorn,
} from "react-icons/fa";

export const saspStar = "/SASPLOGO2.png";
export const saspFavicon = "/SASPfavicon.png"; // Define the favicon path
export const everfallLogo = "/everfall.webp"; // Remove "/public" from the path

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
  const { user, logout } = useAuth();
  // Assuming user type includes roles: user: (User & { roles?: string[] }) | null;
  const isAdmin = user?.role?.includes("admin");

  const getNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `flex items-center px-4 py-2.5 rounded-md transition-colors duration-150 ease-in-out ${
      isActive
        ? "bg-yellow-500 text-black font-semibold shadow-md"
        : "text-gray-300 hover:bg-gray-700 hover:text-white"
    } ${isCollapsed ? "justify-center" : ""}`; // Center icons when collapsed

  return (
    <div
      className={`${
        isCollapsed ? "w-16" : "w-64"
      } h-screen bg-gray-900 text-gray-200 flex flex-col fixed shadow-lg z-50 transition-all duration-300 ease-in-out`}
    >
      {/* Logo and Title */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 h-16">
        <div className="flex items-center overflow-hidden">
          <img
            src={isCollapsed ? saspFavicon : saspStar}
            alt="SASP Logo"
            className={`flex-shrink-0 object-contain transition-all duration-300 ${
              isCollapsed ? "h-8 w-8" : "h-10 w-10"
            }`}
          />
          {!isCollapsed && (
            <span className="text-xl font-bold text-yellow-400 ml-3 whitespace-nowrap">
              SASP Portal
            </span>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-300 hover:text-white focus:outline-none flex-shrink-0"
        >
          {isCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-grow px-3 py-4 space-y-2 overflow-y-auto overflow-x-hidden">
        <NavLink to="/" className={getNavLinkClass} title="Home">
          <FaHome className={isCollapsed ? "" : "mr-3"} />
          {!isCollapsed && "Home"}
        </NavLink>
        <NavLink
          to="/bulletins"
          className={getNavLinkClass}
          title="Bulletin Board"
        >
          <FaBullhorn className={isCollapsed ? "" : "mr-3"} />
          {!isCollapsed && "Bulletin"}
        </NavLink>
        <NavLink
          to="/my-dashboard"
          className={getNavLinkClass}
          title="Dashboard"
        >
          <FaUserCircle className={isCollapsed ? "" : "mr-3"} />
          {!isCollapsed && "Dashboard"}
        </NavLink>
        <NavLink
          to="/sasp-roster"
          className={getNavLinkClass}
          title="SASP Roster"
        >
          <FaUsers className={isCollapsed ? "" : "mr-3"} />
          {!isCollapsed && "SASP Roster"}
        </NavLink>
        <NavLink to="/fleet" className={getNavLinkClass} title="SASP Fleet">
          <FaCar className={isCollapsed ? "" : "mr-3"} />
          {!isCollapsed && "SASP Fleet"}
        </NavLink>
        <NavLink
          to="/badge-lookup"
          className={getNavLinkClass}
          title="Badge Lookup"
        >
          <FaIdBadge className={isCollapsed ? "" : "mr-3"} />
          {!isCollapsed && "Badge Lookup"}
        </NavLink>

        {/* Admin Menu */}
        {isAdmin && (
          <NavLink to="/admin" className={getNavLinkClass} title="Admin Menu">
            <FaTools className={isCollapsed ? "" : "mr-3"} />
            {!isCollapsed && "Admin Menu"}
          </NavLink>
        )}
      </nav>

      {/* Everfall Logo Button */}
      <div className="p-4 border-t border-gray-700">
        <a
          href="https://everfall.com" // Replace with actual Everfall website URL
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center"
          title="Visit Everfall"
        >
          <img
            src={everfallLogo}
            alt="Everfall Logo"
            className={`transition-all duration-300 ${
              isCollapsed ? "h-6" : "h-8" // Adjust size when collapsed
            }`}
          />
        </a>
      </div>

      {/* Footer - Logout */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors duration-150 ease-in-out"
          title="Logout"
        >
          <FaSignOutAlt className={isCollapsed ? "" : "mr-2"} />
          {!isCollapsed && "Logout"}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
