import React, { useState, useEffect, useMemo } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"; // Added useNavigate
import { useAuth } from "../context/AuthContext";
import { hasCIUPermission } from "../utils/ciuUtils";
import { computeIsAdmin } from "../utils/isadmin"; // Import computeIsAdmin
import {
  LayoutDashboard,
  Users,
  Car,
  ClipboardList, // Keep for potential future use
  LogOut,
  FileText, // Keep for potential future use
  GraduationCap,
  ShieldCheck,
  UserCog,
  User,
  MessagesSquare, // Use for Department Chat
  GanttChartSquare, // Use for Gangs
  Briefcase,
  Clipboard, // Use for Cases
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button"; // Import Button component
// Import the new Sidebar component
import Sidebar from "../components/Sidebar";
// Import Avatar components
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
// Import getInitials or similar utility
import { getInitials } from "../utils/getInitials"; // Assuming path
// Import ProfileModal
import ProfileModal from "./ProfileModal"; // Assuming path
// Import NavItemProps type from Sidebar
import { NavItemProps } from "../components/Sidebar";
// Import backgroundImages directly
import { backgroundImages } from "../data/images";
import { FaTachometerAlt, FaUsers, FaCar, FaFileAlt, FaChalkboardTeacher, FaUserSecret, FaUserShield, FaGavel, FaBullhorn, FaSignOutAlt, FaComments, FaBell } from 'react-icons/fa'; // Added FaFileAlt
// Helper function to format name
import { formatUserNameShort } from "./Chat/utils"; // Assuming formatUserNameShort exists or create it

const saspLogo = "/SASPLOGO2.png";

// Removed NavItem interface (using imported NavItemProps)

// Removed ClockDisplay component

// Removed unreadChatCount prop from Layout props
import { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  const { user: currentUser, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // --- State Initialization ---
  // Read from sessionStorage immediately for initial state
  const initialBgImage = sessionStorage.getItem('currentBgImage') || "";
  const initialOpacity = initialBgImage ? 1 : 0; // Start with full opacity if image exists

  // State for background image and opacity
  const [currentBgImage, setCurrentBgImage] = useState<string>(initialBgImage);
  const [bgOpacity, setBgOpacity] = useState(initialOpacity); // Initialize opacity based on stored image
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); // State for profile modal
  // Initialize isCollapsed from localStorage, default to false (expanded)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    return savedState ? JSON.parse(savedState) : false;
  });

  // --- Derived State ---
  const isAdmin = useMemo(() => computeIsAdmin(currentUser), [currentUser]);
  const isFTOQualified = useMemo(() => {
    if (!currentUser || !currentUser.certifications) return false;
    const ftoCert = currentUser.certifications["FTO"];
    return ftoCert === 'CERT' || ftoCert === 'LEAD' || ftoCert === 'SUPER' || ftoCert === 'TRAIN';
  }, [currentUser]);
  const isCadet = useMemo(() => currentUser?.rank?.toLowerCase() === 'cadet', [currentUser]);
  const canAccessCIU = useMemo(() => {
    if (isAdmin) return true;
    if (!currentUser || !currentUser.certifications) return false;
    const ciuCert = currentUser.certifications["CIU"];
    return ciuCert === 'CERT' || ciuCert === 'LEAD' || ciuCert === 'SUPER' || ciuCert === 'TRAIN';
  }, [currentUser, isAdmin]);


  // Effect to save isCollapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Effect for background image loading and transition with persistence
  useEffect(() => {
    const lastBgSetTimeStr = sessionStorage.getItem('lastBgSetTime');
    const storedBgImage = sessionStorage.getItem('currentBgImage');
    const fiveMinutes = 5 * 60 * 1000;
    const now = Date.now();
    const lastBgSetTime = lastBgSetTimeStr ? parseInt(lastBgSetTimeStr, 10) : 0;

    let useEffectCleanup: (() => void) | null = null;

    const setNewBackground = (shouldFadeIn: boolean) => {
      const randomIndex = Math.floor(Math.random() * backgroundImages.length);
      const newBgUrl = backgroundImages[randomIndex];
      const img = new Image();

      img.onload = () => {
        setCurrentBgImage(newBgUrl);
        sessionStorage.setItem('currentBgImage', newBgUrl);
        sessionStorage.setItem('lastBgSetTime', now.toString());
        // Only fade in if explicitly told to (i.e., no image was loaded initially)
        if (shouldFadeIn) {
          setTimeout(() => setBgOpacity(1), 50);
        } else {
          // If not fading in, ensure opacity is 1 (might already be, but safe)
          setBgOpacity(1);
        }
      };
      img.onerror = () => {
        console.error("Failed to load background image:", newBgUrl);
        // Optionally clear storage if load fails?
        if (shouldFadeIn) setBgOpacity(0); // Hide if load fails during fade-in attempt
      };
      img.src = newBgUrl;

      useEffectCleanup = () => {
        img.onload = null;
        img.onerror = null;
      };
    };

    // If there's a stored image AND it's recent, we don't need to do anything here
    // because the initial state already handled it.
    // If there's NO stored image OR it's too old, set a new one.
    if (!storedBgImage || (now - lastBgSetTime >= fiveMinutes)) {
      // Set a new background. Fade in only if there wasn't an initial image.
      setNewBackground(!initialBgImage);
    } else if (!initialBgImage && storedBgImage) {
      // This case handles if sessionStorage had an image, but initial state didn't catch it
      // (shouldn't happen with the new init logic, but as a fallback)
      setCurrentBgImage(storedBgImage);
      setBgOpacity(1); // Ensure opacity is 1
    }

    return () => {
      if (useEffectCleanup) {
        useEffectCleanup();
      }
    };
    // Depend on initialBgImage to know if we should fade in a new background
  }, [initialBgImage]);

  // Effect for redirecting unauthenticated users
  useEffect(() => {
    if (!loading && !currentUser) {
      // Redirect to login if not authenticated
      // NOTE: The actual login component should handle the redirect *to* '/' upon successful login.
      navigate("/login");
    }
  }, [loading, currentUser, navigate]);

  // --- Event Handlers ---
  const toggleProfileModal = () => setIsProfileModalOpen(!isProfileModalOpen); // Handler for profile modal

  // --- Navigation Items ---
  // Use NavItemProps type from Sidebar.tsx
  const navItems = useMemo((): NavItemProps[] => [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      href: "/", // Points to Home.tsx
      showCondition: "always",
      title: "Dashboard",
    },
        {
      name: "Documents",
      icon: Clipboard,
      href: "/Documents",
      showCondition: "always",
      title: "Documents",
    },
    {
      name: "Roster",
      icon: Users,
      href: "/roster",
      showCondition: "always",
      title: "SASP Roster",
    },
    {
      name: "Fleet",
      icon: Car,
      href: "/Fleet",
      showCondition: "always",
      title: "Vehicle Fleet",
    },
    {
      name: "FTO", // Name will be dynamically changed by Sidebar component
      icon: ShieldCheck, // Default icon, will be changed by Sidebar component
      href: "/fto",
      showCondition: "isFTOQualifiedOrCadet",
      title: "FTO Management / Training", // Generic title
    },
    {
      name: "CIU",
      icon: User,
      href: "/ciu",
      showCondition: "canAccessCIU",
      title: "CIU Management",
    },
    {
      name: "Admin Menu",
      icon: UserCog, // Re-using icon, consider a different one if available
      href: "/admin",
      showCondition: "isAdmin",
      title: "Admin Management",
    },
  ], []); // Empty dependency array as base items don't change

  if (loading) {
    return (
      // Basic loading state
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <h1>Loading...</h1>
      </div>
    );
  }

  const userInitials = currentUser?.name ? getInitials(currentUser.name) : '?';
  // Format name for header display (e.g., J. Doe)
  const formattedName = currentUser ? formatUserNameShort(currentUser) : '';

  return (
    // Add relative positioning to the main container
    <div className="relative min-h-screen">
      {/* Background Image Div */}
      <div
        className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${currentBgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: bgOpacity, // Apply opacity state
          transition: "opacity 1.5s ease-in-out", // Add transition effect
        }}
      ></div>

      {/* Content Container (Sidebar + Main) */}
      {/* Add relative positioning and z-index */}
      <div className="flex h-screen relative z-10">
        {/* New Sidebar */}
        <Sidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          navItems={navItems}
          isAdmin={isAdmin}
          isFTOQualified={isFTOQualified}
          canAccessCIU={canAccessCIU}
          isCadet={isCadet}
        />

        {/* Main Content Area */}
        {/* Use main tag and apply dynamic margin */}
        <main className={cn(
            "flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
            // Removed ml-16/ml-64, using pl-16/pl-64 from example
            isCollapsed ? "pl-16" : "pl-64" // Dynamic padding based on sidebar state
        )}>
           {/* Header */}
           <header className="h-16 border-b border-border flex items-center justify-between px-6 flex-shrink-0 bg-[#0a0a0a]"> {/* Changed background color */}
             {/* Left Spacer (optional, if clock isn't perfectly centered otherwise) */}
             <div className="w-16"></div> {/* Adjust width as needed */}
             {/* Right side - User Info and Avatar/Profile Button */}
             <div className="flex items-center gap-3"> {/* Increased gap */}
                {currentUser && (
                    <>
                        {/* User Rank and Name */}
                        <div className="text-right">
                            <p className="text-sm font-medium text-foreground truncate">{currentUser.rank}</p>
                            <p className="text-xs text-muted-foreground truncate">{formattedName}</p>
                        </div>
                        {/* Avatar Button */}
                        <Button variant="ghost" size="icon" onClick={toggleProfileModal} className="rounded-full flex-shrink-0">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={currentUser.photoURL || undefined} alt={currentUser.name ?? 'User'} />
                                <AvatarFallback>{userInitials}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </>
                )}
             </div>
           </header>
           {/* Page Content */}
           <div className="flex-1 overflow-y-auto p-4 md:p-6">
             {children}
           </div>
        </main>

        {/* Profile Modal */}
        {currentUser && (
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={toggleProfileModal}
                user={currentUser}
            />
        )}
      </div>
    </div>
  );
};

export default Layout;

