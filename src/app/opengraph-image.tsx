import { ImageResponse } from "next/og";

export const alt = "Card Club — Poker, Rummy & UNO with friends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Card({ label, suit, red, rotate, x, y, bg }: { label: string; suit: string; red?: boolean; rotate: number; x: number; y: number; bg?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 170,
        height: 238,
        borderRadius: 16,
        background: bg ?? "#fff",
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 20px 50px rgba(0,0,0,.5)",
        display: "flex",
        flexDirection: "column",
        padding: 14,
        color: red ? "#d4213d" : "#111827",
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{label}</div>
      <div style={{ fontSize: 34, lineHeight: 1 }}>{suit}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96 }}>{suit}</div>
    </div>
  );
}

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "radial-gradient(circle at 75% 50%, #11573d 0%, #0b3d2a 35%, #06080d 75%)",
          color: "#e6eaf2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, width: 640 }}>
          <div style={{ fontSize: 30, color: "#f8cf6a", fontWeight: 700, letterSpacing: 4 }}>CARD CLUB</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 18 }}>Card night, anywhere.</div>
          <div style={{ fontSize: 30, color: "#94a0b8", marginTop: 24, lineHeight: 1.35 }}>Poker, Rummy and UNO with friends. Share a code — computer players fill empty seats.</div>
        </div>
        <div style={{ position: "relative", display: "flex", flex: 1 }}>
          <Card label="A" suit="♠" rotate={-16} x={60} y={170} />
          <Card label="K" suit="♥" red rotate={-2} x={200} y={140} />
          <Card label="7" suit="♦" red rotate={14} x={340} y={180} />
        </div>
      </div>
    ),
    size,
  );
}
