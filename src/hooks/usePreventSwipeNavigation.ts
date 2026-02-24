import { useEffect } from "react";

/**
 * Prevents horizontal trackpad swipes from triggering browser back/forward navigation
 * and inverts vertical scroll direction globally (wheel down → scroll up).
 */
export function usePreventSwipeNavigation() {
  useEffect(() => {
    // Prevent swipe-back navigation via CSS
    document.documentElement.style.overscrollBehaviorX = "none";
    document.body.style.overscrollBehaviorX = "none";

    // Invert vertical scroll direction globally
    const handleWheel = (e: WheelEvent) => {
      // Find the nearest vertically scrollable ancestor
      let el = e.target as HTMLElement | null;
      while (el && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollable = overflowY === "auto" || overflowY === "scroll";
        const hasVerticalScroll = el.scrollHeight > el.clientHeight;
        if (isScrollable && hasVerticalScroll) {
          el.scrollTop -= e.deltaY;
          e.preventDefault();
          return;
        }
        el = el.parentElement;
      }

      // Fallback: scroll documentElement
      document.documentElement.scrollTop -= e.deltaY;
      e.preventDefault();
    };

    document.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("wheel", handleWheel);
      document.documentElement.style.overscrollBehaviorX = "";
      document.body.style.overscrollBehaviorX = "";
    };
  }, []);
}
