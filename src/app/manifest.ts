import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Card Club",
    short_name: "Card Club",
    description: "Poker, Rummy and UNO with friends or computer players.",
    start_url: "/",
    display: "standalone",
    background_color: "#06080d",
    theme_color: "#06080d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
