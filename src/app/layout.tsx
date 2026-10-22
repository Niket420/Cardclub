import type { Metadata, Viewport } from "next";
import { Inter, Outfit, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Outfit({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["500", "600", "700", "800"] });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", display: "swap", weight: ["700", "900"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")),
  title: { default: "Card Club — Poker, Rummy & UNO with friends", template: "%s · Card Club" },
  description: "Play Texas Hold'em, Indian Rummy and UNO with friends in your browser. Create a room, share the code, and computer players fill any empty seats. No sign-up.",
  applicationName: "Card Club",
  appleWebApp: { capable: true, title: "Card Club", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "Card Club — card night, anywhere",
    description: "Poker, Rummy and UNO with friends or computer players. Share a code and play — no sign-up.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#06080d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${serif.variable}`}>
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
