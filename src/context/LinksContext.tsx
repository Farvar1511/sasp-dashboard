import React, { createContext, useContext, useEffect, useState } from "react";
import links from "../data/links"; // Import links directly from links.ts

interface LinkItem {
  Label: string;
  Url: string;
  Category: string;
}

interface LinksContextValue {
  links: LinkItem[];
  loading: boolean;
  error: string | null;
}

const LinksContext = createContext<LinksContextValue | undefined>(undefined);

export const LinksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading delay for consistency
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 500); // Adjust delay as needed
  }, []);

  return (
    <LinksContext.Provider value={{ links, loading, error }}>
      {children}
    </LinksContext.Provider>
  );
};

export const useLinks = (): LinksContextValue => {
  const context = useContext(LinksContext);
  if (!context) {
    throw new Error("useLinks must be used within a LinksProvider");
  }
  return context;
};
