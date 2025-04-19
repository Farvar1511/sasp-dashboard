import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { computeIsAdmin } from "../utils/isadmin";
import { showTime } from "../utils/timeHelpers";
import {
  FaHome,
  FaBullhorn,
  FaUsers,
  FaCar,
  FaTools,
  FaSignOutAlt,
  FaChevronLeft,
  FaChevronRight,
  FaFileAlt,
  FaClipboardList,
  FaUserGraduate, // Added for Cadet FTO icon
} from "react-icons/fa";

const saspLogo = "/SASPLOGO2.png";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}

// Add ClockDisplay component to isolate clock rendering:
const ClockDisplay = React.memo(() => {
  const [clock, setClock] = useState(showTime());
  useEffect(() => {
    const interval = setInterval(() => {
      setClock(showTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div
      className="text-[#f3c700] tracking-wide space-y-1"
      style={{ fontFamily: "Orbitron, sans-serif" }}
    >
      <div className="text-md">{clock.day}</div>
      <div className="text-md">{clock.date}</div>
      <div className="text-lg font-semibold">{clock.time}</div>
    </div>
  );
});

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
  const { user, logout } = useAuth();
  const isAdmin = computeIsAdmin(user);
  const ftoCertStatus = user?.certifications?.FTO;
  const hasFTOCert = ftoCertStatus === "CERT" || ftoCertStatus === "LEAD" || ftoCertStatus === "SUPER";
  const isCadet = user?.rank === "Cadet"; // Check if user is a Cadet

  const getNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `flex items-center px-3 py-2.5 rounded-md transition-colors duration-150 ease-in-out border border-transparent ${
      isActive
        ? "bg-[#f3c700] text-black font-semibold shadow-md"
        : "text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-700"
    }`;

  const NavItem = ({
    to,
    icon: Icon,
    label,
    title,
  }: {
    to: string;
    icon: React.ElementType;
    label: string;
    title: string;
  }) => (
    <NavLink to={to} className={getNavLinkClass} title={title}>
      <div className="flex items-center w-full">
        <div className="w-8 h-8 flex items-center justify-center">
          <Icon className="text-[18px]" />
        </div>
        {!isCollapsed && (
          <span className="ml-3 whitespace-nowrap">{label}</span>
        )}
      </div>
    </NavLink>
  );

  return (
    <div
      className={`${
        isCollapsed ? "w-16" : "w-64"
      } h-screen bg-black/90 text-gray-200 flex flex-col fixed shadow-lg z-50 transition-all duration-300 ease-in-out border-r border-gray-800`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 h-16">
        <div className="flex items-center">
          <div className="w-10 h-10 flex items-center justify-center">
            <img
              src={saspLogo}
              alt="SASP Logo"
              className="h-8 w-8 object-contain"
            />
          </div>
          {!isCollapsed && (
            <span className="text-xl font-bold text-[#f3c700] ml-3 whitespace-nowrap">
              SASP Portal
            </span>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-400 hover:text-white focus:outline-none"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-grow px-3 py-4 space-y-2 overflow-y-auto custom-scrollbar">
        <NavItem to="/home" icon={FaHome} label="Home" title="Home" />
        <NavItem
          to="/documents"
          icon={FaFileAlt}
          label="Documents"
          title="Documents"
        />
        <NavItem
          to="/sasp-roster"
          icon={FaUsers}
          label="Roster"
          title="Roster"
        />
        <NavItem
          to="/fleet"
          icon={FaCar}
          label="Fleet"
          title="Fleet"
        />
        {isAdmin && (
          <NavItem
            to="/admin"
            icon={FaTools}
            label="Admin Menu"
            title="Admin Menu"
          />
        )}
        {/* FTO Link for FTO Personnel */}
        {hasFTOCert && !isCadet && ( // Ensure Cadets don't see this if they somehow get FTO cert
          <NavItem
            to="/fto"
            icon={FaClipboardList} // Keep original icon for FTO personnel
            label="FTO Management" // Changed label for clarity
            title="FTO Management Page"
          />
        )}
        {/* FTO Link for Cadets */}
        {isCadet && (
          <NavItem
            to="/fto"
            icon={FaUserGraduate} // Use a different icon for cadets
            label="SASP Training Progress" // Cadet-specific label
            title="SASP Training Progress"
          />
        )}
      </nav>

      {/* Clock */}
      {!isCollapsed && (
        <div className="px-6 py-5 border-t border-gray-800">
          <ClockDisplay />
        </div>
      )}

      {/* Footer */}
      <div className="p-4">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center px-4 py-2 rounded-md bg-red-700 text-white hover:bg-red-800 transition-colors duration-150 ease-in-out"
          title="Logout"
        >
          <div className="w-8 h-8 flex items-center justify-center">
            <FaSignOutAlt className="text-[18px]" />
          </div>
          {!isCollapsed && (
            <span className="ml-2 whitespace-nowrap">Logout</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
