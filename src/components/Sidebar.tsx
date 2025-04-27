import React, { useEffect, useState, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { showTime } from "../utils/timeHelpers";
import { hasCIUPermission } from "../utils/ciuUtils";
import {
  FaHome,
  FaUsers,
  FaCar,
  FaTools,
  FaSignOutAlt,
  FaChevronLeft,
  FaChevronRight,
  FaFileAlt,
  FaUserGraduate,
  FaUserShield,
  FaUserSecret,
} from "react-icons/fa";

const saspLogo = "/SASPLOGO2.png";

// Define the structure for a single nav item prop - EXPORT this type
export interface NavItemProps { // Added export
    name: string;
    href: string;
    icon: React.ComponentType<any>;
    showCondition?: 'always' | 'isAdmin' | 'isFTOQualified' | 'isCadet' | 'canAccessCIU' | 'isFTOQualifiedOrCadet';
    title?: string;
}

// Updated SidebarProps interface
interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  navItems: NavItemProps[]; // Use the defined structure
  isAdmin: boolean;
  isFTOQualified: boolean;
  canAccessCIU: boolean; // Add this line
  isCadet: boolean; // Add this line
}


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

const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  setIsCollapsed,
  navItems, // Use prop
  isAdmin, // Use prop
  isFTOQualified, // Use prop
  canAccessCIU, // Use prop
  isCadet, // Use prop
}) => {
  const { user: currentUser, logout } = useAuth();

  const getNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `flex items-center px-3 py-2.5 rounded-md transition-colors duration-150 ease-in-out border border-transparent ${
      isActive
        ? "bg-[#f3c700] text-black font-semibold shadow-md"
        : "text-white hover:bg-white/10 hover:text-[#f3c700]"
    }`;

  const NavItem = ({
      href,
      icon: Icon,
      name,
      title,
    }: { // Use NavItemProps structure
      href: string;
      icon: React.ComponentType<any>;
      name: string;
      title?: string;
    }) => (
    <NavLink to={href} className={getNavLinkClass} title={title || name}>
      <div className="flex items-center w-full">
        <div className="w-8 h-8 flex items-center justify-center">
          <Icon className="text-[18px]" />
        </div>
        {!isCollapsed && (
          <span className="ml-3 whitespace-nowrap">{name}</span>
        )}
      </div>
    </NavLink>
  );

  // Filter navItems based on props and internal state (isCadet, canAccessCIU)
  const filteredNavItems = useMemo(() => {
    return navItems.filter(item => {
      switch (item.showCondition) {
        case 'isAdmin':
          return isAdmin; // Use prop
        case 'isFTOQualified':
          return isFTOQualified; // Use prop
        case 'isCadet':
          return isCadet; // Use prop
        case 'canAccessCIU':
          return canAccessCIU; // Use prop
        case 'isFTOQualifiedOrCadet':
          return isFTOQualified || isCadet; // Use props
        case 'always':
        default:
          return true;
      }
    }).map(item => {
        // Dynamically adjust icon/label for FTO based on cadet status
        if (item.href === '/fto') {
            return {
                ...item,
                icon: isCadet ? FaUserGraduate : FaUserShield, // Use prop isCadet
                name: isCadet ? "My Training Progress" : "FTO Management", // Use prop isCadet
                title: isCadet ? "My Training Progress" : "FTO Management", // Use prop isCadet
            };
        }
        return item;
    });
  }, [navItems, isAdmin, isFTOQualified, isCadet, canAccessCIU]); // Update dependencies


  // Separate admin item for potential different placement
  const adminItem = filteredNavItems.find(item => item.href === "/admin");
  const regularNavItems = filteredNavItems.filter(item => item.href !== "/admin");

  return (
    <div
      className={`${
        isCollapsed ? "w-16" : "w-64"
      } h-screen bg-black/90 text-gray-200 flex flex-col fixed shadow-lg z-50 transition-all duration-300 ease-in-out border-r border-gray-800`}
    >
      {/* Header section */}
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

      {/* Navigation section - Use filtered navItems */}
      <nav className="flex-grow px-3 py-4 space-y-2 overflow-y-auto custom-scrollbar">
        {/* Map over regularNavItems */}
        {regularNavItems.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
        {/* Render adminItem if it exists */}
        {adminItem && (
          <NavItem key={adminItem.href} {...adminItem} />
        )}
      </nav>

      {/* Clock section */}
      {!isCollapsed && (
        <div className="px-6 py-5 border-t border-gray-800">
          <ClockDisplay />
        </div>
      )}

      {/* Logout section */}
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
