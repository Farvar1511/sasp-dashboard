import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "./Layout";
import links from "../data/links";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const [fullWelcomeMessage, setFullWelcomeMessage] = useState("");
  const [displayedWelcomeMessage, setDisplayedWelcomeMessage] = useState("");
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  const sanitize = (text: string | undefined | null): string =>
    typeof text === "string" ? text.replace(/undefined/g, "").trim() : "";

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const hours = new Date().getHours();
    const greeting =
      hours < 12
        ? "Good Morning"
        : hours < 18
        ? "Good Afternoon"
        : "Good Evening";

    const cleanName = sanitize(user?.name) || "Name Undefined";
    const cleanRank = sanitize(user?.rank) || "Rank Undefined";

    const parts = [greeting + ","];
    if (cleanRank !== "Rank Undefined") {
      parts.push(cleanRank);
    }
    if (cleanName !== "Name Undefined" || cleanRank === "Rank Undefined") {
      parts.push(cleanName);
    }

    const finalMessage = parts.join(" ").trim();
    setFullWelcomeMessage(finalMessage);
  }, [user]);

  useEffect(() => {
    setDisplayedWelcomeMessage("");

    if (!fullWelcomeMessage) return;

    let index = 0;
    let timeoutId: NodeJS.Timeout;

    const typeChar = () => {
      if (index < fullWelcomeMessage.length) {
        const charToAppend = fullWelcomeMessage[index];
        setDisplayedWelcomeMessage((prev) => prev + charToAppend);
        index++;
        timeoutId = setTimeout(typeChar, 100);
      }
    };

    typeChar();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [fullWelcomeMessage]);

  const topLinks = links.filter((link) =>
    ["Fleet Management", "SASP Roster"].includes(link.Label)
  );

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
    <Layout>
      <div className="flex flex-col items-center w-full mx-auto">
        <div className="flex flex-col items-center mb-8 space-y-2">
          <img
            src="https://i.gyazo.com/1e84a251bf8ec475f4849db73766eea7.png"
            alt="SASP Logo"
            className="h-12"
          />
          <img
            src="https://i.gyazo.com/6e5fafdef23c369d0151409fb79b44ca.png"
            alt="SASP Star Badge"
            className="h-16 mt-4"
          />
          <h1 className="text-4xl font-black uppercase text-center drop-shadow-md text-[#f3c700]">
            San Andreas State Police
          </h1>
          <p className="text-lg font-semibold text-center min-h-[1.5em] text-[#f3c700]">
            {displayedWelcomeMessage}
            <span className="animate-pulse">|</span>
          </p>
        </div>

        <div className="bg-black/70 border border-yellow-400 rounded-lg p-4 text-center w-60 mb-8 shadow">
          <div
            className="space-y-1 text-xl font-bold text-yellow-400 font-display"
            style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 500 }}
          >
            <div>{time.toLocaleDateString("en-US", { weekday: "long" })}</div>
            <div>{time.toLocaleDateString("en-US")}</div>
            <div>{time.toLocaleTimeString()}</div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {topLinks.map((link) => (
            <button
              key={link.Label}
              onClick={() => {
                if (link.Label === "SASP Roster") {
                  navigate("/sasp-roster");
                } else if (link.Label === "Fleet Management") {
                  navigate("/fleet");
                } else if (link.Url) {
                  openModal(link.Url);
                }
              }}
              className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg shadow hover:scale-105 hover:bg-yellow-300 transition-transform duration-150 font-sans"
            >
              {link.Label || ""}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
          {Object.entries(groupedLinks).map(([category, items]) => (
            <div
              key={category}
              className="w-full bg-black/70 border border-yellow-400 rounded-lg p-8 shadow-lg transition hover:shadow-yellow-400"
            >
              <h3 className="text-xl font-bold text-yellow-400 mb-4 border-b border-yellow-400 pb-2">
                {category || ""}
              </h3>
              {items.map((item) => (
                <button
                  key={item.Label}
                  onClick={() => item.Url && openModal(item.Url)}
                  className="block w-full px-4 py-2 mb-2 bg-black/70 border border-yellow-400 text-yellow-400 rounded-md font-semibold hover:bg-yellow-300 hover:text-black transition-colors duration-150"
                >
                  {item.Label || ""}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {overlayUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col justify-start items-center">
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
