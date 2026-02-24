import { useEffect } from "react";

/**
 * Prevents horizontal trackpad swipes from triggering browser back/forward navigation.
 * This allows horizontal swipes to only scroll horizontally within scrollable elements.
 */
export function usePreventSwipeNavigation() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only intercept predominantly horizontal scrolls (trackpad swipe gestures).
      // If deltaY is larger than deltaX this is a normal vertical scroll — leave it alone.
      if (Math.abs(e.deltaX) > 0 && Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
        // Always prevent default to stop browser navigation gestures
        // The browser will still scroll horizontally within scrollable elements
        // because we only prevent the navigation, not the scroll
        
        const target = e.target as HTMLElement;
        const scrollableParent = findScrollableParent(target);
        
        if (scrollableParent) {
          // There's a scrollable element - allow it to scroll but prevent navigation
          const { scrollLeft, scrollWidth, clientWidth } = scrollableParent;
          const atLeftEdge = scrollLeft <= 0;
          const atRightEdge = scrollLeft + clientWidth >= scrollWidth - 1;
          
          // If at edge and trying to scroll further, prevent the browser from navigating
          if ((atLeftEdge && e.deltaX < 0) || (atRightEdge && e.deltaX > 0)) {
            e.preventDefault();
          }
        } else {
          // No horizontally scrollable parent - prevent navigation gesture entirely
          e.preventDefault();
        }
      }
    };

    // Find the nearest horizontally scrollable parent
    function findScrollableParent(element: HTMLElement | null): HTMLElement | null {
      while (element && element !== document.body) {
        const style = window.getComputedStyle(element);
        const overflowX = style.overflowX;
        const isScrollable = overflowX === "auto" || overflowX === "scroll";
        const hasHorizontalScroll = element.scrollWidth > element.clientWidth;
        
        if (isScrollable && hasHorizontalScroll) {
          return element;
        }
        element = element.parentElement;
      }
      return null;
    }

    // Also handle the 'popstate' prevention for history navigation
    const handlePopState = (e: PopStateEvent) => {
      // This helps catch any navigation that slips through
    };

    // Prevent the "overscroll" behavior that triggers navigation
    const preventOverscroll = (e: TouchEvent) => {
      // For touch devices
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const target = e.target as HTMLElement;
        
        // Store initial position
        if (!target.dataset.touchStartX) {
          target.dataset.touchStartX = String(touch.clientX);
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const target = e.target as HTMLElement;
        const startX = parseFloat(target.dataset.touchStartX || "0");
        const deltaX = touch.clientX - startX;
        
        // If swiping horizontally at the edge, prevent
        if (Math.abs(deltaX) > 10) {
          const scrollableParent = findScrollableParent(target);
          if (!scrollableParent) {
            e.preventDefault();
          }
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      delete target.dataset.touchStartX;
    };

    // Use passive: false to allow preventDefault
    document.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("touchstart", preventOverscroll, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    // Also set overscroll-behavior via CSS as a fallback
    document.documentElement.style.overscrollBehaviorX = "none";
    document.body.style.overscrollBehaviorX = "none";

    return () => {
      document.removeEventListener("wheel", handleWheel);
      document.removeEventListener("touchstart", preventOverscroll);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.documentElement.style.overscrollBehaviorX = "";
      document.body.style.overscrollBehaviorX = "";
    };
  }, []);
}
