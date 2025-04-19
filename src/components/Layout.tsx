import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { backgroundImages } from "../data/images";
import { FaChalkboardTeacher } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { computeIsAdmin } from "../utils/isadmin";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentBgImage, setCurrentBgImage] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFTOQualified, setIsFTOQualified] = useState(false);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * backgroundImages.length);
    setCurrentBgImage(backgroundImages[randomIndex]);
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

  return (
    <div className="relative min-h-screen">
      <div
        className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${currentBgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      ></div>

      <div className="flex h-screen relative z-10">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />
        <main
          className={`flex-1 overflow-x-hidden overflow-y-auto transition-all duration-300 ease-in-out ${
            isSidebarCollapsed ? "pl-16" : "pl-64"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
