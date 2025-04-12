import { useEffect, useState } from "react";
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
  const [welcomeMessage, setWelcomeMessage] = useState("");

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
    setWelcomeMessage(`${greeting}, ${user.rank} ${lastName}`);
  }, [user]);

  const topBarCategories = ["Fleet Management", "SASP Roster"];
  const excludedCategories = ["Community", "Tools", "Internal"];
  const topLinks = links.filter((link) =>
    topBarCategories.includes(link.Label)
  );
  const groupedLinks = links
    .filter(
      (link) =>
        !topBarCategories.includes(link.Label) &&
        !excludedCategories.includes(link.Category)
    )
    .reduce((acc, curr) => {
      if (!acc[curr.Category]) acc[curr.Category] = [];
      acc[curr.Category].push(curr);
      return acc;
    }, {} as Record<string, typeof links>);

  return (
    <Layout user={user}>
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center blur-sm opacity-50 -z-10"
        style={{ backgroundImage: `url(${background})` }}
      ></div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center px-6 pt-12 max-w-7xl mx-auto">
        {/* Header */}
        <h1 className="text-4xl font-black uppercase text-center mb-4 drop-shadow-md">
          San Andreas State Police
        </h1>
        <p className="text-lg font-semibold text-center mb-8">
          {welcomeMessage}
        </p>

        {/* Clock */}
        <div className="bg-black/70 border border-yellow-400 rounded-lg p-4 text-center w-52 mb-8 shadow">
          <div className="font-orbitron text-md space-y-1">
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
              onClick={() => window.open(link.Url, "_blank")}
              className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg shadow hover:scale-105 hover:bg-yellow-300 transition-transform duration-150"
            >
              {link.Label}
            </button>
          ))}
        </div>

        {/* Grouped Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(groupedLinks).map(([category, items]) => (
            <div
              key={category}
              className="bg-black/70 border border-yellow-400 rounded-lg p-5 shadow-lg"
            >
              <h3 className="text-xl font-bold mb-3">{category}</h3>
              {items.map((item) => (
                <button
                  key={item.Label}
                  onClick={() => window.open(item.Url, "_blank")}
                  className="block w-full px-4 py-2 mb-2 bg-black border border-yellow-400 text-yellow-400 rounded-md font-semibold hover:bg-yellow-300 hover:text-black transition-colors duration-150"
                >
                  {item.Label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
