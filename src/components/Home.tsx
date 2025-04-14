import React, { useEffect, useState } from "react";

export default function Home() {
  const [typewriterText, setTypewriterText] = useState<string>("");
  const fullText = "Welcome to the San Andreas State Police Portal";

  useEffect(() => {
    // Typewriter effect
    let index = 0;
    const interval = setInterval(() => {
      if (index < fullText.length) {
        setTypewriterText((prev) => prev + fullText[index]);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 100); // Adjust typing speed here
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center h-full">
      <h1 className="text-4xl font-bold text-yellow-400 text-center bg-black bg-opacity-60 p-4 rounded">
        {typewriterText}
      </h1>
    </div>
  );
}
