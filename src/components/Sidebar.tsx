import React, { useEffect, useState, useMemo } from "react"; // Removed useCallback if handleChatSelect is gone
import { NavLink, Link } from "react-router-dom";
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
    FaComments,
} from "react-icons/fa";
import { DepartmentChatPopup } from "./DepartmentChatPopup";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge"; // Import Badge
import { useNotificationStore } from "../store/notificationStore"; // Import store
import { User } from "../types/User"; // Import User type

const saspLogo = "/SASPLOGO2.png";

// Define ClockDisplay component here
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
    allUsers: User[]; // Add allUsers prop
}

// Helper component for individual navigation items
const NavItem = ({
    href,
    icon: Icon,
    name,
    title,
    isCollapsed, // Receive isCollapsed state
    getNavLinkClass, // Receive className function
}: NavItemProps & { isCollapsed: boolean; getNavLinkClass: (props: { isActive: boolean }) => string }) => (
    <NavLink
        to={href}
        // Pass isActive to the function provided by getNavLinkClass
        className={({ isActive }) => getNavLinkClass({ isActive })}
        title={title || name} // Use title for tooltip, fallback to name
    >
        {/* Use a function child to access isActive state */}
        {({ isActive }) => (
            <>
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    {/* Conditionally apply yellow color if not active */}
                    <Icon className={`text-[18px] ${!isActive ? 'text-[#f3c700]' : ''}`} />
                </div>
                {!isCollapsed && (
                    <span className="ml-3 whitespace-nowrap">{name}</span>
                )}
            </>
        )}
    </NavLink>
);


const Sidebar: React.FC<SidebarProps> = ({
    isCollapsed,
    setIsCollapsed,
    navItems,
    isAdmin,
    isFTOQualified,
    canAccessCIU,
    isCadet,
    allUsers, // Destructure allUsers
}) => {
    const { user: currentUser, logout } = useAuth();
    const [isDepartmentChatOpen, setIsDepartmentChatOpen] = useState(false);
    const departmentUnreadCount = useNotificationStore(state => state.getUnreadCount('department')); // Get unread count

    const getNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `flex items-center ${isCollapsed ? 'justify-center' : ''} px-3 py-2.5 rounded-md transition-colors duration-150 ease-in-out border border-transparent ${
    isActive
      ? "bg-[#f3c700] text-black font-semibold shadow-md"
      : "text-white hover:bg-white/10 hover:text-[#f3c700]"
  }`;

    // Filter nav items based on conditions
    const filteredNavItems = useMemo(() => {
        return navItems.filter(item => {
            switch (item.showCondition) {
                case 'isAdmin': return isAdmin;
                case 'isFTOQualified': return isFTOQualified;
                case 'isCadet': return isCadet;
                case 'canAccessCIU': return canAccessCIU;
                case 'isFTOQualifiedOrCadet': return isFTOQualified || isCadet;
                case 'always':
                default: return true;
            }
        }).map(item => {
            // Dynamically change CIU item name/icon
            if (item.href === '/ciu' && canAccessCIU) {
                 // Ensure the icon component itself is passed correctly
                 return { ...item, name: 'CIU Portal', icon: FaUserSecret, title: 'CIU Management Portal' };
            }
            // Ensure FTO icons are passed correctly
            if (item.href === '/fto') {
                if (isCadet) {
                    return { ...item, name: 'Cadet Training', icon: FaUserGraduate, title: 'Cadet Training Portal' };
                } else if (isFTOQualified) {
                    return { ...item, name: 'FTO Portal', icon: FaUserShield, title: 'FTO Management Portal' };
                }
                // Add a fallback if neither condition is met but href is /fto
                // This might not be necessary depending on your logic, but good practice
                // return { ...item, name: 'Training Portal', icon: FaUserGraduate, title: 'Training Portal' };
            }
            return item;
        });
    }, [navItems, isAdmin, isFTOQualified, isCadet, canAccessCIU]); // Update dependencies


    // Separate admin item for potential different placement
    const adminItem = filteredNavItems.find(item => item.href === "/admin");
    const regularNavItems = filteredNavItems.filter(item => item.href !== "/admin");

    return (
        <div
            className={`fixed top-0 left-0 h-screen bg-[#0a0a0a] border-r border-gray-800 flex flex-col transition-all duration-300 ease-in-out z-30 ${
                isCollapsed ? "w-20" : "w-64"
            }`}
        >
            {/* Header section */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800 h-16">
                {!isCollapsed && (
                    <Link to="/" className="flex items-center gap-2">
                        <img src={saspLogo} alt="SASP Logo" className="h-8 w-auto" />
                        {/* Apply yellow color to the text */}
                        <span className="font-semibold text-lg text-[oklch(0.84_0.1726_92.66)]">SASP Portal</span>
                    </Link>
                )}
                <Button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="text-gray-400 hover:text-white focus:outline-none"
                    title={isCollapsed ? "Expand" : "Collapse"}
                >
                    {isCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
                </Button>
            </div>

            {/* Navigation section - Use filtered navItems */}
            <nav className="flex-grow px-3 py-4 space-y-2 overflow-y-auto custom-scrollbar">
                {/* Map over regularNavItems */}
                {regularNavItems.map((item) => (
                    <NavItem
                        key={item.href}
                        {...item}
                        isCollapsed={isCollapsed}
                        getNavLinkClass={getNavLinkClass} // Pass the function itself
                    />
                ))}
                {/* Render adminItem if it exists */}
                {adminItem && (
                     <NavItem
                        key={adminItem.href}
                        {...adminItem}
                        isCollapsed={isCollapsed}
                        getNavLinkClass={getNavLinkClass} // Pass the function itself
                    />
                )}
            </nav>

            {/* Clock section */}
            {!isCollapsed && (
                <div className="px-6 py-5 border-t border-gray-800">
                    <ClockDisplay />
                </div>
            )}

            {/* Department Chat Button */}
            <div className="px-3 py-2 relative"> {/* Add relative positioning */}
                <Button
                    onClick={() => setIsDepartmentChatOpen(prev => !prev)}
                    className={`w-full flex items-center px-3 py-2.5 rounded-md transition-colors duration-150 ease-in-out border border-transparent ${
                        isDepartmentChatOpen
                            ? "bg-muted text-foreground" // Use theme colors if available, otherwise adjust
                            : "text-white hover:bg-white/10 hover:text-[#f3c700]"
                    } ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                    title="Department Chat"
                    variant="ghost"
                >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <FaComments className="text-[18px]" />
                    </div>
                    {!isCollapsed && (
                        <span className="ml-3 whitespace-nowrap">Department Chat</span>
                    )}
                    {/* Unread Count Badge */}
                    {departmentUnreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className={`absolute top-1.5 right-1.5 h-5 min-w-[1.25rem] flex items-center justify-center p-1 text-xs ${
                                isCollapsed ? "left-auto right-1.5" : "" // Adjust position when collapsed
                            }`}
                        >
                            {departmentUnreadCount > 9 ? '9+' : departmentUnreadCount}
                        </Badge>
                    )}
                </Button>
            </div>

            {/* Logout section */}
            <div className="p-4 border-t border-gray-800 mt-auto">
                <button
                    onClick={logout}
                    className={`w-full flex items-center px-3 py-2.5 rounded-md transition-colors duration-150 ease-in-out bg-red-700 text-white hover:bg-red-800 ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                    title="Logout"
                >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0"> {/* Ensure icon doesn't shrink */}
                        <FaSignOutAlt className="text-[18px]" />
                    </div>
                    {!isCollapsed && (
                        <span className="ml-3 whitespace-nowrap">Logout</span>
                    )}
                </button>
            </div>

            {/* Department Chat Popup - Render conditionally */}
            {isDepartmentChatOpen && (
                <DepartmentChatPopup
                    // isOpen prop removed
                    onClose={() => setIsDepartmentChatOpen(false)}
                    allUsers={allUsers} // Pass allUsers down
                />
            )}
        </div>
    );
};

export default Sidebar;
