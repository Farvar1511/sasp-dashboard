import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { backgroundImages } from "../data/images";
import { FaChalkboardTeacher } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { computeIsAdmin } from "../utils/isadmin";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"; // Import Avatar components
import ProfileModal from "./ProfileModal"; // Import the new modal
import { getInitials } from "../utils/getInitials"; // Helper to get initials

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentBgImage, setCurrentBgImage] = useState<string>("");
  const [bgOpacity, setBgOpacity] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFTOQualified, setIsFTOQualified] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); // State for modal

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * backgroundImages.length);
    const img = new Image();
    img.onload = () => {
      setCurrentBgImage(backgroundImages[randomIndex]);
      // Use a short timeout to ensure the image is set before starting the transition
      setTimeout(() => setBgOpacity(1), 50);
    };
    img.src = backgroundImages[randomIndex];

    // Optional: Cleanup function in case the component unmounts before load
    return () => {
      img.onload = null;
    };
  }, []);

  useEffect(() => {
    if (user) {
      const adminStatus = computeIsAdmin(user);
      setIsAdmin(adminStatus);

      const ftoCert = user.certifications?.FTO;
      const qualified =
        adminStatus ||
        ftoCert === "CERT" ||
        ftoCert === "LEAD" ||
        ftoCert === "SUPER" ||
        ftoCert === "TRAIN";
      setIsFTOQualified(qualified);
    } else {
      setIsAdmin(false);
      setIsFTOQualified(false);
    }
  }, [user]);

  const navItems = [
    {
      name: "FTO Management",
      href: "/fto",
      icon: FaChalkboardTeacher,
      show: !loading && isFTOQualified,
    },
  ];

  const handleAvatarClick = () => {
    setIsProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  // Get user initials for fallback
  const userInitials = user?.name ? getInitials(user.name) : "?";

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        // @ts-ignore - Ignoring potential mismatch in SidebarProps definition in Sidebar.tsx
        navItems={navItems}
        isAdmin={isAdmin}
        isFTOQualified={isFTOQualified}
      />
      <div
        className={`page-background transition-opacity duration-1000 ${
          bgOpacity === 1 ? "opacity-100" : "opacity-0"
        }`}
        style={{ backgroundImage: `url(${currentBgImage})` }}
      ></div>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[-1]"></div>

      <main
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          isSidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        {/* Optional Header Bar */}
        <header className="bg-background/80 backdrop-blur-sm border-b border-border h-16 flex items-center justify-between px-6 sticky top-0 z-10">
          {/* Placeholder for potential header content like breadcrumbs or search */}
          <div></div>
          {/* User Avatar/Menu */}
          {!loading && user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.rank} {user.name}
              </span>
              <Avatar
                className="h-9 w-9 cursor-pointer hover:ring-2 hover:ring-ring"
                onClick={handleAvatarClick} // Open modal on click
              >
                <AvatarImage src={user.photoURL ?? undefined} alt={user.name ?? "User"} />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </div>
          )}
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>

      {/* Profile Modal */}
      {user && (
          <ProfileModal
            isOpen={isProfileModalOpen}
            onClose={closeProfileModal}
            user={user}
          />
      )}
    </div>
  );
};

export default Layout;
