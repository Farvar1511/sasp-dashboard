import { useState, useEffect } from "react";

const TypewriterEffect = ({ text }: { text: string | undefined }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!text) {
      setDisplayedText("Unknown"); // Fallback for undefined names
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text[index]);
      index++;
      if (index === text.length) clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [text]);

  return <span>{displayedText}</span>;
};

export default TypewriterEffect;
