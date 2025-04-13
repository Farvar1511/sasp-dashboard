import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import Layout from "./Layout";
import links from "../data/links";
import { images } from "../data/images";

interface User {
  name: string;
  rank: string;
  email: string;
}

export default function Dashboard({ user }: { user: User }) {
  const [background, setBackground] = useState("");
  const [time, setTime] = useState(new Date());
  const [fullWelcomeMessage, setFullWelcomeMessage] = useState(""); // Renamed state for the full message
  const [displayedWelcomeMessage, setDisplayedWelcomeMessage] = useState(""); // State for the typewriter effect
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const navigate = useNavigate(); // Instantiate useNavigate

  useEffect(() => {
    const randomImage = images[Math.floor(Math.random() * images.length)];
    setBackground(randomImage);

    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const hours = new Date().getHours();
    const greeting =
      hours < 12
        ? "Good Morning"
        : hours < 18
        ? "Good Afternoon"
        : "Good Evening";
    const lastName = user.name.split(" ").slice(-1)[0];
    setFullWelcomeMessage(`${greeting}, ${user.rank} ${lastName}`);
  }, [user]);

  useEffect(() => {
    setDisplayedWelcomeMessage("");

    if (fullWelcomeMessage) {
      let index = 0;
      const typingInterval = setInterval(() => {
        setDisplayedWelcomeMessage((prev) => prev + fullWelcomeMessage[index]);
        index++;
        if (index === fullWelcomeMessage.length) {
          clearInterval(typingInterval);
        }
      }, 100);

      return () => clearInterval(typingInterval);
    }
  }, [fullWelcomeMessage]);

  // Separate top links
  const topLinks = links.filter((link) =>
    ["Fleet Management", "SASP Roster"].includes(link.Label)
  );

  // Group remaining links by category, excluding internal/community/tools
  const excludedCategories = ["Community", "Tools", "Internal"];
  const groupedLinks = links
    .filter(
      (link) =>
        !["Fleet Management", "SASP Roster"].includes(link.Label) &&
        !excludedCategories.includes(link.Category)
    )
    .reduce((acc, link) => {
      if (!acc[link.Category]) acc[link.Category] = [];
      acc[link.Category].push(link);
      return acc;
    }, {} as Record<string, typeof links>);

  const openModal = (url: string) => setOverlayUrl(url);
  const closeModal = () => setOverlayUrl(null);

  return (
    <Layout user={user}>
      {/* Background Image */}
      {background && (
        <div
          className="fixed top-0 left-0 w-full h-full bg-cover bg-center opacity-40 -z-10 backdrop-blur-md"
          style={{
            backgroundImage: `url('${background}')`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            backgroundAttachment: "fixed",
          }}
        />
      )}

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-[1600px] px-10 pt-6 mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-8 space-y-2">
          {/* SASP Logo */}
          <img
            src="https://i.gyazo.com/1e84a251bf8ec475f4849db73766eea7.png" // Verified URL
            alt="SASP Logo"
            className="h-12" // 3rem
          />
          {/* SASP Star Badge */}
          <img
            src="https://i.gyazo.com/6e5fafdef23c369d0151409fb79b44ca.png" // Verified URL
            alt="SASP Star Badge"
            className="h-16 mt-4" // Added margin-top for spacing
          />
          <h1 className="text-4xl font-black uppercase text-center drop-shadow-md">
            San Andreas State Police
          </h1>
          <p className="text-lg font-semibold text-center min-h-[1.5em]">
            {" "}
            {/* Added min-height to prevent layout shift */}
            {displayedWelcomeMessage}
            <span className="animate-pulse">|</span>{" "}
            {/* Optional blinking cursor */}
          </p>
        </div>

        {/* Clock */}
        <div className="bg-black/70 border border-yellow-400 rounded-lg p-4 text-center w-60 mb-8 shadow">
          <div
            className="space-y-1 text-xl font-bold text-yellow-400"
            style={{ fontFamily: "Orbitron, sans-serif" }}
          >
            <div>{time.toLocaleDateString("en-US", { weekday: "long" })}</div>
            <div>{time.toLocaleDateString("en-US")}</div>
            <div>{time.toLocaleTimeString()}</div>
          </div>
        </div>

        {/* Top Links */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {topLinks.map((link) => (
            <button
              key={link.Label}
              onClick={() => {
                if (link.Label === "SASP Roster") {
                  navigate("/sasp-roster");
                } else if (link.Label === "Fleet Management") {
                  navigate("/fleet"); // Navigate to /fleet for Fleet Management button
                } else {
                  openModal(link.Url); // Fallback for any other unexpected top links
                }
              }}
              className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg shadow hover:scale-105 hover:bg-yellow-300 transition-transform duration-150"
            >
              {link.Label}
            </button>
          ))}
        </div>

        {/* Grouped Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
          {Object.entries(groupedLinks).map(([category, items]) => (
            <div
              key={category}
              className="w-full bg-black/70 border border-yellow-400 rounded-lg p-8 shadow-lg transition hover:shadow-yellow-400"
            >
              <h3 className="text-xl font-bold text-yellow-400 mb-4 border-b border-yellow-400 pb-2">
                {category}
              </h3>
              {items.map((item) => (
                <button
                  key={item.Label}
                  onClick={() => openModal(item.Url)}
                  className="block w-full px-4 py-2 mb-2 bg-black/70 border border-yellow-400 text-yellow-400 rounded-md font-semibold hover:bg-yellow-300 hover:text-black transition-colors duration-150"
                >
                  {item.Label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Modal Overlay */}
      {overlayUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col justify-start items-center">
          {/* Controls container - align with sidebar and limit width */}
          <div className="w-full flex justify-end gap-2 p-4 z-10 ml-40 max-w-[calc(100%-10rem)]">
            <a
              href={overlayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold hover:bg-yellow-300 transition"
            >
              🔗 Open in New Tab
            </a>
            <button
              className="bg-red-500 text-white px-4 py-2 rounded-full font-bold hover:bg-red-400 transition"
              onClick={closeModal}
            >
              ✕
            </button>
          </div>
          {/* Iframe container - align with sidebar and limit width */}
          <div className="flex-grow w-full h-full bg-black border border-yellow-400 rounded-lg overflow-hidden ml-40 max-w-[calc(100%-10rem)]">
            <iframe
              src={overlayUrl}
              title="Modal Content"
              className="w-full h-full border-none"
            ></iframe>
          </div>
        </div>
      )}
    </Layout>
  );
}
