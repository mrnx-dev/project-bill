"use client";

import { useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";

export function SwipeSidebarHandler() {
    const { setOpenMobile, openMobile, isMobile } = useSidebar();
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    // Only render the active swipe zone if the sidebar is closed and we are on mobile.
    if (openMobile || !isMobile) return null;

    return (
        <div
            // top-16 ensures we don't block the hamburger menu on the top header
            className="fixed top-16 left-0 w-8 h-[calc(100vh-4rem)] z-40 md:hidden"
            // touch-action prevents the browser's horizontal swipe-to-back gesture
            // allowing us to reliably capture the horizontal swipe to open the sidebar.
            style={{ touchAction: "pan-y" }}
            onTouchStart={(e) => {
                touchStartRef.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                };
            }}
            onTouchMove={(e) => {
                if (!touchStartRef.current) return;
                const deltaX = e.touches[0].clientX - touchStartRef.current.x;
                const deltaY = e.touches[0].clientY - touchStartRef.current.y;

                // Trigger if swipe is mostly horizontal and goes right by more than 30px
                if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 30) {
                    setOpenMobile(true);
                    touchStartRef.current = null;
                }
            }}
            onTouchEnd={() => {
                touchStartRef.current = null;
            }}
            onTouchCancel={() => {
                touchStartRef.current = null;
            }}
        />
    );
}
