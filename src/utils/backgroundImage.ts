import { images } from "../data/images";

export function getRandomBackgroundImage(): string {
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}
