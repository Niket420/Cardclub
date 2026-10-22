import type { Metadata } from "next";
import { LocalGame } from "@/components/room/LocalGame";

export const metadata: Metadata = { title: "Play vs computer" };

export default function Page() {
  return <LocalGame />;
}
