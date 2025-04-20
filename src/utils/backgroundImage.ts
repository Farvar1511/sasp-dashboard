import { images } from "../data/images";

const ROTATION_INTERVAL = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = "backgroundImageData";

interface StoredImageData {
  url: string;
  timestamp: number;
}

export function getRandomBackgroundImage(): string {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);

    if (storedData) {
      const { url, timestamp }: StoredImageData = JSON.parse(storedData);
      const now = Date.now();

      if (now - timestamp < ROTATION_INTERVAL) {
        return url;
      }
    }

    const randomIndex = Math.floor(Math.random() * images.length);
    const newUrl = images[randomIndex];

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ url: newUrl, timestamp: Date.now() })
    );

    return newUrl;
  } catch {
    // Fallback if localStorage fails
    const randomIndex = Math.floor(Math.random() * images.length);
    return images[randomIndex];
  }
}
