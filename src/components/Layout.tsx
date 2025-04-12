import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { images } from "../data/images";

export default function Layout({
  children,
  user,
}: {
  children: React.ReactNode;
  user: any;
}) {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [background, setBackground] = useState("");

  useEffect(() => {
    const randomImage = images[Math.floor(Math.random() * images.length)];
    setBackground(randomImage);
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Background Image */}
      {background && (
        <div
          className="fixed top-0 left-0 w-full h-full bg-cover bg-center opacity-40 -z-10"
          style={{
            backgroundImage: `url('${background}')`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            backgroundAttachment: "fixed", // Ensure background stays fixed
          }}
        />
      )}

      {/* Main Content */}
      <div className="dashboard flex relative z-10">
        <Sidebar
          navigate={navigate}
          user={user}
          isCollapsed={isSidebarCollapsed}
          toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <main
          className={`page-content transition-all duration-300 ${
            isSidebarCollapsed ? "ml-16" : "ml-40"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
