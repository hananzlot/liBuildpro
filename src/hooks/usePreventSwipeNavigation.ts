import { useEffect } from "react";

/**
 * Prevents horizontal trackpad swipes from triggering browser back/forward navigation.
 * This allows horizontal swipes to only scroll horizontally within scrollable elements.
 */
export function usePreventSwipeNavigation() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Check if this is a horizontal scroll (trackpad swipe)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Check if we're at the edge of a scrollable element
        const target = e.target as HTMLElement;
        const scrollableParent = findScrollableParent(target);
        
        if (scrollableParent) {
          const { scrollLeft, scrollWidth, clientWidth } = scrollableParent;
          const atLeftEdge = scrollLeft <= 0;
          const atRightEdge = scrollLeft + clientWidth >= scrollWidth - 1;
          
          // If at edge and trying to scroll further in that direction, prevent navigation
          if ((atLeftEdge && e.deltaX < 0) || (atRightEdge && e.deltaX > 0)) {
            e.preventDefault();
          }
        } else {
          // No scrollable parent, prevent navigation gesture entirely
          e.preventDefault();
        }
      }
    };

    // Find the nearest horizontally scrollable parent
    function findScrollableParent(element: HTMLElement | null): HTMLElement | null {
      while (element) {
        const { overflowX } = window.getComputedStyle(element);
        const isScrollable = overflowX === "auto" || overflowX === "scroll";
        const hasHorizontalScroll = element.scrollWidth > element.clientWidth;
        
        if (isScrollable && hasHorizontalScroll) {
          return element;
        }
        element = element.parentElement;
      }
      return null;
    }

    // Use passive: false to allow preventDefault
    document.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("wheel", handleWheel);
    };
  }, []);
}
