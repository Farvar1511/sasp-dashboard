import React, { useState, useEffect } from "react"; // Added useEffect
import Sidebar from "./Sidebar";
import { backgroundImages } from "../data/images"; // Import the image array

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentBgImage, setCurrentBgImage] = useState<string>("");

  // Select a random background image on component mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * backgroundImages.length);
    setCurrentBgImage(backgroundImages[randomIndex]);
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <div className="relative min-h-screen">
      {/* Background Image Container */}
      <div
        className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${currentBgImage})`,
          backgroundSize: "cover", // Ensure the image covers the entire screen
          backgroundPosition: "center", // Center the image
          backgroundRepeat: "no-repeat", // Prevent tiling
        }}
      ></div>

      {/* Main Flex Container */}
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
