"use client";

import { RefObject, useEffect, useState } from "react";

/** Measures a container and returns the negative margin needed to fit `count` cards of `cardWidth` px. */
export function useFanOverlap(ref: RefObject<HTMLElement | null>, count: number, cardWidth: number, gap = 6, minVisible = 0.3) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  if (!width || count <= 1) return { margin: gap, width };
  const natural = count * cardWidth + (count - 1) * gap;
  if (natural <= width) return { margin: gap, width };
  const step = Math.max(cardWidth * minVisible, (width - cardWidth) / (count - 1));
  return { margin: step - cardWidth, width };
}

/** Pixel width of a CSS clamp() card size at the current viewport. */
export function useCardPx(min: number, vw: number, max: number) {
  const [px, setPx] = useState(min);
  useEffect(() => {
    const calc = () => setPx(Math.max(min, Math.min(max, (window.innerWidth * vw) / 100)));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [min, vw, max]);
  return px;
}
