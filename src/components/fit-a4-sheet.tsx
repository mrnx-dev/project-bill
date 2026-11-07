"use client";

import { useEffect } from "react";

/**
 * Scales the A4 invoice sheet to fit the viewport on phones so it looks
 * exactly like the desktop version (just smaller). Uses CSS zoom (falling
 * back to transform on old Safari) and re-fits on rotation/resize.
 */
export function FitA4Sheet({ sheetWidth = 794 }: { sheetWidth?: number }) {
  useEffect(() => {
    const fit = () => {
      const sheet = document.querySelector<HTMLElement>(".a4-sheet");
      if (!sheet) return;
      const vw = window.innerWidth;
      // vw already includes the scrollbar, so account for the page's horizontal padding
      const available = Math.min(vw, document.documentElement.clientWidth) - 16;
      const scale = available < sheetWidth ? available / sheetWidth : 1;
      if (typeof sheet.style.zoom === "string") {
        sheet.style.zoom = String(scale);
        sheet.style.transform = "";
      } else {
        sheet.style.transform = `scale(${scale})`;
        sheet.style.transformOrigin = "top center";
      }
    };
    fit();
    const reset = () => {
      const sheet = document.querySelector<HTMLElement>(".a4-sheet");
      if (sheet) {
        sheet.style.zoom = "";
        sheet.style.transform = "";
      }
    };
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    window.addEventListener("beforeprint", reset);
    window.addEventListener("afterprint", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
      window.removeEventListener("beforeprint", reset);
      window.removeEventListener("afterprint", fit);
    };
  }, [sheetWidth]);
  return null;
}
