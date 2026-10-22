"use client";

import qrcode from "qrcode-generator";
import { useMemo } from "react";

export function QrCode({ value, size = 168 }: { value: string; size?: number }) {
  const path = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { d, n };
  }, [value]);
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${path.n + 4} ${path.n + 4}`} className="rounded-xl bg-white" shapeRendering="crispEdges" role="img" aria-label="QR code to join">
      <path d={path.d} fill="#0b0f17" />
    </svg>
  );
}
