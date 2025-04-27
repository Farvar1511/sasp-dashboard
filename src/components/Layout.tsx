import React, { useState, useEffect, useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar, { NavItemProps } from "./Sidebar";
import { getRandomBackgroundImage } from "../utils/backgroundImage";
import { useAuth } from "../context/AuthContext";
import { computeIsAdmin } from "../utils/isadmin";
import { hasCIUPermission } from "../utils/ciuUtils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import ProfileModal from "./ProfileModal";
import { getInitials } from "../utils/getInitials";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  FaHome,
  FaUsers,
  FaCar,
  FaTools,
  FaFileAlt,
  FaChalkboardTeacher,
  FaUserSecret,
  FaBell,
} from "react-icons/fa";

interface LayoutProps {
  unreadChatCount?: number;
  children?: React.ReactNode;    // ← allow children
}

const Layout: React.FC<LayoutProps> = ({
  unreadChatCount = 0,
  children,                      // ← destructure it
}) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bgImage, setBgImage] = useState("");
  const [bgOpacity, setBgOpacity] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  // Derived flags
  const isAdmin = useMemo(() => computeIsAdmin(user), [user]);
  const isCadet = useMemo(() => user?.rank === "Cadet", [user?.rank]);
  const ftoCert = user?.certifications?.FTO?.toUpperCase() ?? "";
  const isFTOQualified = useMemo(
    () => ["CERT", "LEAD", "SUPER", "TRAIN"].includes(ftoCert),
    [ftoCert]
  );
  const canAccessCIU = useMemo(() => !!user && hasCIUPermission(user), [user]);

  // Random background
  useEffect(() => {
    const url = getRandomBackgroundImage();
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      setBgImage(url);
      setTimeout(() => setBgOpacity(1), 50);
    };
    img.src = url;
    return () => { img.onload = null; };
  }, []);

  // Build nav items
  const navItems: NavItemProps[] = useMemo(() => [
    { name: "Home", href: "/home", icon: FaHome, showCondition: "always" },
    { name: "Documents", href: "/documents", icon: FaFileAlt, showCondition: "always" },
    { name: "Roster", href: "/sasp-roster", icon: FaUsers, showCondition: "always" },
    { name: "Fleet", href: "/fleet", icon: FaCar, showCondition: "always" },
    {
      name: "FTO",
      href: "/fto",
      icon: FaChalkboardTeacher,
      showCondition: "isFTOQualifiedOrCadet",
    },
    {
      name: "CIU Management",
      href: "/ciu-management",
      icon: FaUserSecret,
      showCondition: "canAccessCIU",
    },
    { name: "Admin Menu", href: "/admin", icon: FaTools, showCondition: "isAdmin" },
  ], []);

  const initials = user?.name ? getInitials(user.name) : "?";

  return (
    <div className="relative flex h-screen bg-background text-foreground">
      {/* Background */}
      <div
        className="absolute inset-0 z-[-1] bg-cover bg-center transition-opacity duration-500 ease-in-out"
        style={{ backgroundImage: `url(${bgImage})`, opacity: bgOpacity }}
      />

      {/* SINGLE Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
        navItems={navItems}
        isAdmin={isAdmin}
        isFTOQualified={isFTOQualified}
        canAccessCIU={canAccessCIU}
        isCadet={isCadet}
      />

      {/* Main */}
      <main
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        {/* Header */}
        <header className="bg-background/80 backdrop-blur-sm border-b border-border h-16 flex items-center justify-between px-6 sticky top-0 z-10">
          <div />
          {!loading && user && (
            <div className="flex items-center gap-4">
              {canAccessCIU && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/ciu-management", { state: { focusTab: "chat" } })}
                  title={unreadChatCount > 0 ? `${unreadChatCount} unread` : "CIU Chat"}
                  className="relative text-muted-foreground hover:text-foreground"
                >
                  <FaBell className="h-5 w-5" />
                  {unreadChatCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-full"
                    >
                      {unreadChatCount > 9 ? "9+" : unreadChatCount}
                    </Badge>
                  )}
                </Button>
              )}
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.rank} {user.name}
              </span>
              <Avatar
                className="h-9 w-9 cursor-pointer hover:ring-2 hover:ring-ring"
                onClick={() => setProfileOpen(true)}
              >
                <AvatarImage src={user.photoURL ?? undefined} alt={user.name ?? "User"} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </div>
          )}
        </header>

        {/* ← now render whatever children you passed in (your <Outlet/>) */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>

      {/* Profile Modal */}
      {user && <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} user={user} />}
    </div>
  );
};

export default Layout;
