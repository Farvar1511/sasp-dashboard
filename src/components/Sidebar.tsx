import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { computeIsAdmin } from "../utils/isadmin";
import { showTime } from "../utils/timeHelpers";
import {
  FaHome,
  FaUsers,
  FaCar,
  FaTools,
  FaSignOutAlt,
  FaChevronLeft,
  FaChevronRight,
  FaFileAlt,
  FaUserGraduate, // Added for Cadet FTO icon
  FaUserShield, // Added for FTO Management icon
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
  const ftoCertStatus = user?.certifications?.FTO?.toUpperCase(); // Ensure comparison is case-insensitive
  // Include 'TRAIN' in the check for FTO certification
  const hasFTOCert = ["CERT", "LEAD", "SUPER", "TRAIN"].includes(ftoCertStatus || "");
  const isCadet = user?.rank === "Cadet"; // Check if user is a Cadet

  const getNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `flex items-center px-3 py-2.5 rounded-md transition-colors duration-150 ease-in-out border border-transparent ${
      isActive
        ? "bg-[#f3c700] text-black font-semibold shadow-md"
        : "text-white hover:bg-white/10 hover:text-[#f3c700]"
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

  // Define all potential nav items
  const allNavItems = [
    { to: "/home", icon: FaHome, label: "Home", title: "Home", show: true },
    { to: "/documents", icon: FaFileAlt, label: "Documents", title: "Documents", show: true },
    { to: "/sasp-roster", icon: FaUsers, label: "Roster", title: "Roster", show: true },
    { to: "/fleet", icon: FaCar, label: "Fleet", title: "Fleet", show: true },
    // FTO Link with conditional text and icon
    {
      to: "/fto",
      icon: isCadet ? FaUserGraduate : FaUserShield,
      label: isCadet ? "My Training Progress" : "FTO Management",
      title: isCadet ? "My Training Progress" : "FTO Management",
      show: hasFTOCert || isCadet, // Show if FTO certified OR if user is a Cadet
    },
    // Admin Menu item definition
    { to: "/admin", icon: FaTools, label: "Admin Menu", title: "Admin Menu", show: isAdmin },
  ];

  // Filter items to show, separating the Admin item
  const adminItem = allNavItems.find(item => item.to === "/admin");
  const regularNavItems = allNavItems.filter(item => item.show && item.to !== "/admin");

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
        {/* Render regular items */}
        {regularNavItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
        {/* Render Admin item last if it should be shown */}
        {adminItem && adminItem.show && (
          <NavItem key={adminItem.to} {...adminItem} />
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
