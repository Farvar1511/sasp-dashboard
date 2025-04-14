import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { images } from "../data/images";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [background, setBackground] = useState<string>("");

  useEffect(() => {
    const randomImage = images[Math.floor(Math.random() * images.length)];
    setBackground(randomImage);
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Background Image - Fixed position */}
      {background && (
        <div
          className="fixed inset-0 w-full h-full bg-cover bg-center -z-10"
          style={{
            backgroundImage: `url('${background}')`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        />
      )}
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      {/* Main Content Area - Apply overlay and blur */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isCollapsed ? "ml-16" : "ml-64"
        } p-6 bg-black/50 backdrop-blur-[3px] overflow-y-auto`}
      >
        {children}
      </main>
    </div>
  );
}
