import type { Metadata } from "next";
import { OnlineRoom } from "@/components/room/OnlineRoom";
import { normalizeCode } from "@/lib/room";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const code = normalizeCode((await params).code);
  return {
    title: `Room ${code}`,
    description: `You're invited to a card game on Card Club. Room code ${code} — open the link and enter your name to join.`,
    openGraph: { title: `Join my table on Card Club · ${code}`, description: "Poker, Rummy & UNO with friends. Tap to join — no sign-up." },
  };
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  return <OnlineRoom code={code} />;
}
