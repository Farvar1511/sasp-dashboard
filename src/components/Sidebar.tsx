import React, { useEffect, useState, useMemo } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { showTime } from "../utils/timeHelpers";
import {
    School,
    Fingerprint,
    Wrench, // Replaces FaTools
    LogOut, // Replaces FaSignOutAlt
    ChevronLeft, // Replaces FaChevronLeft
    ChevronRight, // Replaces FaChevronRight
    FileText, // Replaces FaFileAlt
    GraduationCap, // Replaces FaUserGraduate
    ShieldCheck, // Replaces FaUserShield
    UserCog, // Replaces FaUserSecret for CIU Portal
    MessageSquare, // Replaces FaComments
    Lightbulb, // Replaces FaLightbulb
} from "lucide-react";
import { DepartmentChatPopup } from "./DepartmentChatPopup";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useNotificationStore } from "../store/notificationStore";
import { User } from "../types/User";
import SubmitCIUTipModal, { TipDetails } from "./CaseFiles/SubmitCIUTipModal";
import { toast } from "react-toastify";
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db as dbFirestore } from "../firebase";
import { CaseFile, CaseStatus } from "../utils/ciuUtils";

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
    icon: React.ComponentType<any>; // Lucide icons fit this type
    showCondition?: 'always' | 'isAdmin' | 'isFTOQualified' | 'isCadet' | 'canAccessCIU' | 'isFTOQualifiedOrCadet';
    title?: string;
}

// Updated SidebarProps interface
interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: (isCollapsed: boolean) => void;
    navItems: NavItemProps[];
    isAdmin: boolean;
    isFTOQualified: boolean;
    canAccessCIU: boolean;
    isCadet: boolean;
    allUsers: User[];
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
                    <Icon className={`text-[18px] ${!isActive ? 'text-brand' : ''}`} />
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
    const [isCIUTipModalOpen, setIsCIUTipModalOpen] = useState(false); // State for CIU Tip Modal

    const getNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
        `flex items-center ${isCollapsed ? 'justify-center' : ''} px-3 py-2.5 rounded-md transition-colors duration-150 ease-in-out border border-transparent ${
            isActive
                ? "bg-brand text-black font-semibold shadow-md" // Use brand background, black text
                : "text-white hover:bg-white/10 hover:text-black" // Hover: black text
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
                 return { ...item, name: 'CIU Portal', icon: Fingerprint, title: 'CIU Management Portal' };
            }
            // Ensure FTO icons are passed correctly
            if (item.href === '/fto') {
                if (isCadet) {
                    return { ...item, name: 'Cadet Training', icon: GraduationCap, title: 'Cadet Training Portal' };
                } else if (isFTOQualified) {
                    return { ...item, name: 'FTO Portal', icon: School, title: 'FTO Management Portal' };
                }
                // If neither cadet nor FTO qualified, but the item is for /fto,
                // it might have been filtered out by showCondition already.
                // If it's meant to show with a default, handle that here or adjust showCondition.
                // For now, assume it's correctly filtered if neither condition is met.
            }
            return item;
        });
    }, [navItems, isAdmin, isFTOQualified, isCadet, canAccessCIU]); // Update dependencies


    type EligibleAssignee = User; // Simplified, User type should be sufficient

    // Updated handleSubmitCIUTip to create a CaseFile
    const handleSubmitCIUTip = async ({ tipDetails, assignee }: { tipDetails: TipDetails; assignee: EligibleAssignee | null }) => {
        setIsCIUTipModalOpen(false);
        
        if (!currentUser) {
            toast.error("You must be logged in to submit a tip.");
            return;
        }
        
        toast.info(`Submitting CIU tip as ${currentUser.name}...`);

        const caseTitle = tipDetails.title || `CIU Tip: ${tipDetails.summary.substring(0, 30)}${tipDetails.summary.length > 30 ? '...' : ''} - ${new Date().toLocaleDateString()}`;
        
        const initialUpdateNote = `Case created from CIU tip submitted by ${currentUser.name || 'Unknown User'}${assignee ? ` and initially assigned to ${assignee.name}` : ''}.
Tip Summary: ${tipDetails.summary}`;

        const detailsObjectForCase = {
            originalDataSource: 'userSubmittedTip', // Changed from 'anonymousTip'
            submittedVia: 'CIUTipModal',
            incidentReport: tipDetails.incidentReport || '',
            evidence: tipDetails.evidence || [],
            photos: tipDetails.photos || [], // Will also be in CaseFile.imageLinks
            photoSectionDescription: tipDetails.photoSectionDescription || '',
            location: tipDetails.location || '',
            namesOfInterest: tipDetails.namesOfInterest || [],
            gangInfo: tipDetails.gangInfo || '',
            videoNotes: tipDetails.videoNotes || '',
            charges: tipDetails.charges || [],
            updates: [{
                note: initialUpdateNote,
                userId: currentUser.id ?? "UNKNOWN_SUBMITTER_ID", // Use current user's ID
                userName: currentUser.name ?? "Unknown Submitter", // Use current user's name
                timestamp: serverTimestamp(),
                edited: false,
            }],
        };

        const newCaseData: Omit<CaseFile, 'id'> = {
            title: caseTitle,
            description: tipDetails.summary, // Main summary here
            status: assignee ? 'Open - Assigned' : 'Open - Unassigned' as CaseStatus,
            assignedToId: assignee?.id || null,
            assignedToName: assignee?.name || null,
            createdBy: currentUser.id ?? "UNKNOWN_SUBMITTER_ID", // Use current user's ID
            createdByName: currentUser.name ?? "Unknown Submitter", // Use current user's name
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
            imageLinks: tipDetails.photos || [],
            details: JSON.stringify(detailsObjectForCase),
        };

        try {
            const docRef = await addDoc(collection(dbFirestore, 'caseFiles'), newCaseData);
            toast.success(`Tip submitted by ${currentUser.name} and case file (ID: ${docRef.id.substring(0,6)}) created successfully.`);
        } catch (error) {
            console.error("Error submitting tip and creating case:", error);
            toast.error("Failed to submit tip as case. Please try again or contact support.");
        }
    };


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
                    {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
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
                        getNavLinkClass={getNavLinkClass}
                    />
                ))}
                {/* Render adminItem if it exists */}
                {adminItem && (
                     <NavItem
                        key={adminItem.href}
                        {...adminItem}
                        isCollapsed={isCollapsed}
                        getNavLinkClass={getNavLinkClass}
                    />
                )}
            </nav>

            {/* Submit CIU Tip Button - Placed above the clock */}
            {canAccessCIU && (
                <div className="px-3 py-2">
                    <Button
                        onClick={() => setIsCIUTipModalOpen(true)}
                        className={`w-full flex items-center px-3 py-2.5 rounded-md transition-colors duration-150 ease-in-out border border-transparent text-white hover:bg-white/10 hover:text-black ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                        title="Submit CIU Tip"
                        variant="ghost"
                    >
                        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                            <Lightbulb className="text-[18px] text-[#f3c700]" />
                        </div>
                        {!isCollapsed && (
                            <span className="ml-3 whitespace-nowrap">Submit CIU Tip</span>
                        )}
                    </Button>
                </div>
            )}

            {/* Clock section */}
            {!isCollapsed && (
                <div className="px-6 py-5 border-t border-gray-800">
                    <ClockDisplay />
                </div>
            )}

            {/* Department Chat Button */}
            <div className="px-3 py-2 relative">
                <Button
                    onClick={() => setIsDepartmentChatOpen(prev => !prev)}
                    className={`w-full flex items-center px-3 py-2.5 rounded-md transition-colors duration-150 ease-in-out border border-transparent ${
                        isDepartmentChatOpen
                            ? "bg-muted text-black" // Active: black text
                            : "text-white hover:bg-white/10 hover:text-black" // Hover: black text
                    } ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                    title="Department Chat"
                    variant="ghost"
                >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="text-[18px]" />
                    </div>
                    {!isCollapsed && (
                        <span className="ml-3 whitespace-nowrap">Department Chat</span>
                    )}
                    {/* Unread Count Badge */}
                    {departmentUnreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className={`absolute top-1.5 right-1.5 h-5 min-w-[1.25rem] flex items-center justify-center p-1 text-xs ${
                                isCollapsed ? "left-auto right-1.5" : ""
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
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <LogOut className="text-[18px]" />
                    </div>
                    {!isCollapsed && (
                        <span className="ml-3 whitespace-nowrap">Logout</span>
                    )}
                </button>
            </div>

            {/* Department Chat Popup - Render conditionally */}
            {isDepartmentChatOpen && (
                <DepartmentChatPopup
                    onClose={() => setIsDepartmentChatOpen(false)}
                    allUsers={allUsers}
                />
            )}

            {/* CIU Tip Modal - Render conditionally */}
            {isCIUTipModalOpen && (
                <SubmitCIUTipModal
                    isOpen={isCIUTipModalOpen}
                    onClose={() => setIsCIUTipModalOpen(false)}
                    onSubmit={handleSubmitCIUTip}
                />
            )}
        </div>
    );
};

export default Sidebar;
